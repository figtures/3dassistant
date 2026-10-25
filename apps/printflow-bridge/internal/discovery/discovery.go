// Package discovery sıfır yapılandırmalı yazıcı keşfi: Bambu SSDP, mDNS (Klipper/OctoPrint/Prusa…),
// Elegoo SDCP, Snapmaker / Flashforge UDP, gerekirse bilinen-port taraması. JSON şeması
// tools/printflow-bridge/discovery (Node) ile birebir aynıdır.
package discovery

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/printflow/printflow-bridge/internal/config"
)

// SchemaVersion `discover --json` çıktı sürümü.
const SchemaVersion = 1

// Options keşif ayarları.
type Options struct {
	Timeout     time.Duration // yayın dinleme süresi (varsayılan 6 sn)
	Scan        string        // auto | always | never (auto = yayınla desteklenen yazıcı yoksa tara)
	Hosts       []string      // elle IP (misafir ağı / farklı alt ağ)
	Paired      []config.PrinterEntry
	SlicerCodes map[string]string // seri → erişim kodu (yalnızca "mevcut" bilgisi için)
	Progress    func(string)
	Interfaces  []Interface // nil = sistem arayüzleri
}

// MethodStat yöntem başına sonuç sayısı + hatalar.
type MethodStat struct {
	Count  int      `json:"count"`
	Errors []string `json:"errors"`
}

// ScanStat port taraması istatistiği.
type ScanStat struct {
	Count        int      `json:"count"`
	Errors       []string `json:"errors"`
	ScannedHosts int      `json:"scannedHosts"`
	LiveHosts    int      `json:"liveHosts"`
}

// Methods yöntem istatistikleri (Node çıktısıyla aynı anahtar sırası).
type Methods struct {
	SSDP       MethodStat `json:"ssdp"`
	MDNS       MethodStat `json:"mdns"`
	SDCP       MethodStat `json:"sdcp"`
	Snapmaker  MethodStat `json:"snapmaker-udp"`
	Flashforge MethodStat `json:"flashforge-udp"`
	Scan       *ScanStat  `json:"scan,omitempty"`
}

// Result `discover --json` çıktısı.
type Result struct {
	Version    int             `json:"version"`
	ScannedAt  string          `json:"scannedAt"`
	DurationMs int64           `json:"durationMs"`
	Interfaces []InterfaceInfo `json:"interfaces"`
	Methods    Methods         `json:"methods"`
	Warnings   []string        `json:"warnings"`
	Printers   []Printer       `json:"printers"`
	BambuCloud BambuCloudInfo  `json:"bambuCloud"`
}

func stat(r methodResult) MethodStat {
	errs := r.Errors
	if errs == nil {
		errs = []string{}
	}
	return MethodStat{Count: len(r.Candidates), Errors: errs}
}

// portScan /24 başına bilinen portlar; kısa zaman aşımı + eşzamanlılık sınırı.
func portScan(ctx context.Context, ifaces []Interface, progress func(string)) (cands []candidate, scannedHosts, liveHosts int) {
	const (
		concurrency = 192
		timeout     = 450 * time.Millisecond
		maxHosts    = 1024
	)
	var own []string
	for _, i := range ifaces {
		own = append(own, i.Address)
	}
	seen := map[string]bool{}
	var hosts []string
	for _, i := range ifaces {
		for _, h := range hostsInCidr(i.CIDR, own) {
			if !seen[h] {
				seen[h] = true
				hosts = append(hosts, h)
			}
		}
	}
	if len(hosts) > maxHosts {
		hosts = hosts[:maxHosts]
	}
	type job struct {
		host string
		port int
	}
	var jobs []job
	for _, h := range hosts {
		for _, p := range ScanPorts {
			jobs = append(jobs, job{h, p})
		}
	}
	var mu sync.Mutex
	open := map[string][]int{}
	var openOrder []string
	done := 0
	mapLimit(jobs, concurrency, func(j job, _ int) struct{} {
		ok := ctx.Err() == nil && tcpOpen(ctx, j.host, j.port, timeout)
		mu.Lock()
		if ok {
			if _, exists := open[j.host]; !exists {
				openOrder = append(openOrder, j.host)
			}
			open[j.host] = append(open[j.host], j.port)
		}
		done++
		if progress != nil && done%256 == 0 {
			progress(fmt.Sprintf("Port taraması: %d/%d", done, len(jobs)))
		}
		mu.Unlock()
		return struct{}{}
	})
	results := mapLimit(openOrder, 16, func(h string, _ int) []candidate {
		return probeHost(ctx, h, open[h], 600*time.Millisecond).Candidates
	})
	for _, r := range results {
		cands = append(cands, r...)
	}
	return cands, len(hosts), len(open)
}

// Discover tüm yöntemleri çalıştırır ve birleştirilmiş, sıralı yazıcı listesini döner.
func Discover(ctx context.Context, opts Options) Result {
	started := time.Now()
	timeout := opts.Timeout
	if timeout <= 0 {
		timeout = 6 * time.Second
	}
	scan := opts.Scan
	if scan == "" {
		scan = "auto"
	}
	progress := opts.Progress
	if progress == nil {
		progress = func(string) {}
	}
	ifaces := opts.Interfaces
	if ifaces == nil {
		ifaces = ListScanInterfaces(SystemInterfaces())
	}
	warnings := []string{}
	if len(ifaces) == 0 {
		warnings = append(warnings, "Özel ağ (192.168.x / 10.x / 172.16-31.x) arayüzü bulunamadı. Bilgisayar yazıcıyla aynı Wi-Fi/Ethernet ağında mı? VPN açıksa kapatıp deneyin.")
	}

	progress(fmt.Sprintf("Ağ dinleniyor (SSDP, mDNS, SDCP, Snapmaker, Flashforge) — %d sn…", int(timeout.Seconds()+0.5)))
	short := min(timeout, 3500*time.Millisecond)
	udpShort := min(short, 2500*time.Millisecond)
	settled := make([]methodResult, 5)
	var wg sync.WaitGroup
	runs := []func() methodResult{
		func() methodResult { return discoverBambuSsdp(ctx, timeout, ifaces) },
		func() methodResult { return discoverMdns(ctx, short, ifaces) },
		func() methodResult { return discoverSdcp(ctx, udpShort, ifaces, nil) },
		func() methodResult { return discoverSnapmaker(ctx, udpShort, ifaces, nil) },
		func() methodResult { return discoverFlashforge(ctx, udpShort, ifaces) },
	}
	for i, fn := range runs {
		wg.Add(1)
		go func() {
			defer wg.Done()
			settled[i] = fn()
		}()
	}
	wg.Wait()

	methods := Methods{
		SSDP:       stat(settled[0]),
		MDNS:       stat(settled[1]),
		SDCP:       stat(settled[2]),
		Snapmaker:  stat(settled[3]),
		Flashforge: stat(settled[4]),
	}
	var candidates []candidate
	for _, r := range settled {
		candidates = append(candidates, r.Candidates...)
	}

	var toVerify []candidate
	for _, c := range candidates {
		if c.Serial == "" || c.Confidence < 0.8 {
			toVerify = append(toVerify, c)
		}
	}
	if len(toVerify) > 0 {
		progress(fmt.Sprintf("%d aday doğrulanıyor…", len(toVerify)))
	}
	for _, v := range mapLimit(toVerify, 8, func(c candidate, _ int) *candidate { return verifyCandidate(ctx, c) }) {
		if v != nil {
			candidates = append(candidates, *v)
		}
	}

	for _, h := range opts.Hosts {
		h = strings.TrimSpace(h)
		if h == "" {
			continue
		}
		progress("Elle girilen IP yoklanıyor: " + h)
		r := probeHost(ctx, h, nil, 1500*time.Millisecond)
		for _, c := range r.Candidates {
			c.Methods = append(append([]string{}, c.Methods...), "manual")
			candidates = append(candidates, c)
		}
		if len(r.Candidates) == 0 {
			if len(r.OpenPorts) > 0 {
				ports := make([]string, len(r.OpenPorts))
				for i, p := range r.OpenPorts {
					ports[i] = fmt.Sprint(p)
				}
				warnings = append(warnings, fmt.Sprintf("%s: açık port var (%s) ama yazıcı tanınmadı.", h, strings.Join(ports, ", ")))
			} else {
				warnings = append(warnings, fmt.Sprintf("%s: bilinen yazıcı portlarından yanıt yok (IP doğru mu, yazıcı açık mı, aynı ağda mı?).", h))
			}
		}
	}

	supportedSoFar := false
	for _, c := range candidates {
		if IsDriverVendor(c.Vendor) {
			supportedSoFar = true
			break
		}
	}
	multicastBroken := true
	for _, r := range settled {
		if len(r.Errors) == 0 && len(r.Candidates) > 0 {
			multicastBroken = false
		}
	}
	if len(ifaces) > 0 && ctx.Err() == nil && (scan == "always" || (scan == "auto" && !supportedSoFar)) {
		if scan == "always" {
			progress("Yerel ağ bilinen yazıcı portları için taranıyor…")
		} else {
			progress("Yayınla yazıcı bulunamadı; yerel ağ bilinen yazıcı portları için taranıyor…")
		}
		found, scanned, live := portScan(ctx, ifaces, progress)
		methods.Scan = &ScanStat{Count: len(found), Errors: []string{}, ScannedHosts: scanned, LiveHosts: live}
		candidates = append(candidates, found...)
		if len(found) > 0 && multicastBroken {
			warnings = append(warnings, "Yazıcı yalnızca port taramasıyla bulundu: ağ/güvenlik duvarı çoklu yayını (UDP 2021, mDNS 5353) engelliyor olabilir. Çalışır ama keşif yavaşlar.")
		}
	}

	arp := readArpTable(ctx)
	for i := range candidates {
		if candidates[i].MAC == "" {
			if m, ok := arp[candidates[i].Host]; ok {
				candidates[i].MAC = m
			}
		}
	}

	printers := finalizeCandidates(mergeCandidates(candidates), opts.Paired, opts.SlicerCodes)
	if len(printers) == 0 {
		warnings = append(warnings, "Yazıcı bulunamadı. Kontrol edin: yazıcı açık ve bu bilgisayarla aynı ağda mı (misafir Wi-Fi ayrı ağdır)? Bambu'da LAN Only / Developer Mode, Creality'de yerel ağ erişimi açık mı? macOS'ta Ayarlar → Gizlilik → Yerel Ağ iznini verin. Son çare: IP adresini elle girin (--host IP).")
	}
	infos := make([]InterfaceInfo, len(ifaces))
	for i, ifc := range ifaces {
		infos[i] = InterfaceInfo{Name: ifc.Name, Address: ifc.Address, CIDR: ifc.CIDR}
	}
	return Result{
		Version:    SchemaVersion,
		ScannedAt:  started.UTC().Format("2006-01-02T15:04:05.000Z"),
		DurationMs: time.Since(started).Milliseconds(),
		Interfaces: infos,
		Methods:    methods,
		Warnings:   warnings,
		Printers:   printers,
	}
}

// ProbeHost tek bir IP'yi bilinen yazıcı portları için yoklar (elle IP girişi).
func ProbeHost(ctx context.Context, host string, paired []config.PrinterEntry, slicerCodes map[string]string) []Printer {
	r := probeHost(ctx, strings.TrimSpace(host), nil, 1500*time.Millisecond)
	cands := make([]candidate, 0, len(r.Candidates))
	for _, c := range r.Candidates {
		c.Methods = append(append([]string{}, c.Methods...), "manual")
		cands = append(cands, c)
	}
	arp := readArpTable(ctx)
	for i := range cands {
		if cands[i].MAC == "" {
			cands[i].MAC = arp[cands[i].Host]
		}
	}
	return finalizeCandidates(mergeCandidates(cands), paired, slicerCodes)
}

func matchesEntry(p Printer, e config.PrinterEntry) bool {
	if !strings.EqualFold(p.Vendor, e.Vendor) {
		return false
	}
	if e.Serial != "" && (strings.EqualFold(p.Serial, e.Serial) || strings.EqualFold(PairingSerial(p), e.Serial)) && (p.Serial != "" || p.MAC != "") {
		return true
	}
	em := normalizeMac(e.MAC)
	return em != "" && p.MAC == em
}

// Rediscover çalışma döngüsü: IP'si değişmiş (DHCP) yazıcıyı seri/MAC ile yeniden bulur.
// Önce yalnızca yayın (5 sn), bulunamazsa kısa yayın + tam port taraması.
func Rediscover(ctx context.Context, e config.PrinterEntry) *Printer {
	find := func(res Result) *Printer {
		for i := range res.Printers {
			if matchesEntry(res.Printers[i], e) {
				p := res.Printers[i]
				return &p
			}
		}
		return nil
	}
	if hit := find(Discover(ctx, Options{Timeout: 5 * time.Second, Scan: "never"})); hit != nil {
		return hit
	}
	if ctx.Err() != nil {
		return nil
	}
	return find(Discover(ctx, Options{Timeout: time.Second, Scan: "always"}))
}
