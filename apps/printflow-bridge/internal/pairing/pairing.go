// Package pairing eşleştirme kodu + LAN keşfi ile ortam değişkeni gerektirmeyen yazıcı ekleme akışı.
package pairing

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/printflow/printflow-bridge/internal/config"
	"github.com/printflow/printflow-bridge/internal/discovery"
	"github.com/printflow/printflow-bridge/internal/drivers/lanapi"
	"github.com/printflow/printflow-bridge/internal/poller"
	"github.com/printflow/printflow-bridge/internal/printflow"
)

// ErrNeedsInteraction etkileşimsiz modda seçim/sır kullanıcıdan istenmeli (çıkış kodu 3).
var ErrNeedsInteraction = errors.New("kullanıcı seçimi gerekli")

type Options struct {
	URL, Code string
	// Eski akış: --host + --serial verilirse keşif atlanır.
	Vendor, Serial, Host, Label, Name string
	AccessCode, Password, APIKey      string
	TLSInsecure                       bool
	LanPort                           int
	// Seçim: "1,3" | All | Yes (etkileşimsiz) | JSON (stdout'a sonuç)
	Select      string
	All, Yes    bool
	JSON        bool
	SlicerCodes string // ask | use | no
	Cloud       discovery.CloudOptions
	Scan        string
	Timeout     time.Duration

	AgentVersion string
	In           io.Reader
	Out          io.Writer // istemler ve tablo (stderr)
	Stdout       io.Writer // --json çıktısı
	Interactive  bool
}

var codeRe = regexp.MustCompile(`^\d{6}$`)

func ValidCode(c string) bool { return codeRe.MatchString(c) }

// IsTerminal stdin bir terminal mi (etkileşimli seçim ekranı için).
func IsTerminal(f *os.File) bool {
	st, err := f.Stat()
	if err != nil || st.Mode()&os.ModeCharDevice == 0 {
		return false
	}
	if null, err := os.Stat(os.DevNull); err == nil && os.SameFile(st, null) {
		return false
	}
	return true
}

type session struct {
	o       Options
	ctx     context.Context
	rd      *bufio.Reader
	cfg     *config.File
	slicer  map[string]string
	sources []string
	// Bambu hesabından yerelde alınan kodlar; cloudDone = bir kez denendi/reddedildi (tekrar sorulmaz).
	cloud     map[string]string
	cloudDone bool
	paired    []pairedOut
}

type pairedOut struct {
	MachineID string `json:"machineId"`
	Vendor    string `json:"vendor"`
	Serial    string `json:"serial"`
	Host      string `json:"host"`
	Name      string `json:"name,omitempty"`
	Verified  bool   `json:"verified"`
	Warning   string `json:"warning,omitempty"`
}

func (s *session) say(format string, args ...any) { fmt.Fprintf(s.o.Out, format, args...) }

func (s *session) ask(prompt string) (string, error) {
	if !s.o.Interactive {
		return "", ErrNeedsInteraction
	}
	s.say("%s", prompt)
	line, err := s.rd.ReadString('\n')
	if err != nil && line == "" {
		s.o.Interactive = false
		return "", ErrNeedsInteraction
	}
	return strings.TrimSpace(line), nil
}

// Run eşleştirme: keşif → seçim → sır → yazıcıda doğrulama → pair API → yerel config (0600).
func Run(ctx context.Context, o Options) error {
	if o.Out == nil {
		o.Out = os.Stderr
	}
	if o.Stdout == nil {
		o.Stdout = os.Stdout
	}
	if o.In == nil {
		o.In = os.Stdin
	}
	if o.Yes || o.JSON {
		o.Interactive = false
	}
	if o.URL == "" || o.Code == "" {
		return fmt.Errorf("Gerekli: --url ve --code (veya printflow://pair bağlantısı)")
	}
	if !ValidCode(strings.TrimSpace(o.Code)) {
		return fmt.Errorf("eşleştirme kodu 6 haneli olmalı")
	}
	o.Vendor = strings.ToLower(strings.TrimSpace(o.Vendor))
	cfg, _ := config.Load()
	if cfg == nil {
		cfg = &config.File{}
	}
	s := &session{o: o, ctx: ctx, rd: bufio.NewReader(o.In), cfg: cfg}
	if o.SlicerCodes != "no" {
		s.slicer, s.sources = discovery.ReadSlicerAccessCodes()
	}

	var targets []discovery.Printer
	legacy := o.Host != "" && o.Serial != ""
	if legacy {
		v := o.Vendor
		if v == "" {
			v = "bambu"
		}
		targets = []discovery.Printer{{Vendor: v, Host: o.Host, Serial: o.Serial, Name: o.Label, LanPort: o.LanPort, Supported: true}}
	} else {
		var err error
		targets, err = s.choose()
		if err != nil {
			return err
		}
	}

	var firstErr error
	for _, p := range targets {
		if err := s.pairOne(p, legacy, len(targets) == 1); err != nil {
			var pe *printflow.PairError
			if errors.As(err, &pe) && (pe.Status == 401 || pe.Status == 402 || pe.Status == 403) {
				return err
			}
			if errors.Is(err, ErrNeedsInteraction) {
				return err
			}
			if len(targets) > 1 {
				s.say("✗ %s %s: %v\n", p.VendorLabel, p.Host, err)
			}
			if firstErr == nil {
				firstErr = err
			}
		}
	}
	if o.JSON {
		b, _ := json.MarshalIndent(map[string]any{"paired": s.paired}, "", "  ")
		fmt.Fprintln(o.Stdout, string(b))
	}
	if len(s.paired) == 0 && firstErr != nil {
		return firstErr
	}
	return nil
}

func (s *session) discover(hosts []string) discovery.Result {
	s.say("Yerel ağda yazıcılar aranıyor…\n")
	opts := discovery.Options{
		Timeout:     s.o.Timeout,
		Scan:        s.o.Scan,
		Paired:      s.cfg.Printers,
		SlicerCodes: s.slicer,
		Progress:    func(m string) { s.say("  %s\n", m) },
	}
	if len(hosts) > 0 {
		opts.Hosts = hosts
	}
	res := discovery.Discover(s.ctx, opts)
	s.applyCloud(&res)
	if s.o.Vendor != "" {
		filtered := res.Printers[:0]
		for _, p := range res.Printers {
			if p.Vendor == s.o.Vendor {
				filtered = append(filtered, p)
			}
		}
		res.Printers = filtered
	}
	return res
}

// applyCloud eksik Bambu kodlarını (onaylı) Bambu hesabından yerelde alır; sonuç oturum boyunca saklanır.
func (s *session) applyCloud(res *discovery.Result) {
	if s.cloudDone {
		discovery.MarkAccessCodes(res.Printers, s.cloud, "Bambu hesabı")
		return
	}
	co := s.o.Cloud
	asked := false
	if s.o.Interactive {
		co.Consent = func(app string) bool {
			asked = true
			ans, err := s.ask(fmt.Sprintf("%s Bambu oturumu bulundu. Erişim kodu Bambu hesabınızdan alınsın mı? (yalnızca bu bilgisayardan Bambu'ya; PrintFlow'a gönderilmez) [E/h]: ", app))
			return err == nil && !strings.HasPrefix(strings.ToLower(ans), "h") && !strings.HasPrefix(strings.ToLower(ans), "n")
		}
	}
	codes := discovery.ApplyBambuCloud(s.ctx, res, co)
	if len(codes) > 0 || asked {
		s.cloud, s.cloudDone = codes, true
	}
}

// choose keşif sonuçlarından eşleştirilecek yazıcıları seçer.
func (s *session) choose() ([]discovery.Printer, error) {
	var hosts []string
	if s.o.Host != "" {
		hosts = []string{s.o.Host}
	}
	for {
		res := s.discover(hosts)
		for _, w := range res.Warnings {
			s.say("! %s\n", w)
		}
		list := discovery.PrimaryCandidates(res.Printers)
		if s.o.Host != "" {
			only := list[:0]
			for _, p := range list {
				if p.Host == s.o.Host {
					only = append(only, p)
				}
			}
			list = only
		}
		PrintTable(s.o.Out, list)

		eligible := func(p discovery.Printer) bool { return p.Supported && !p.Paired }
		if s.o.Select != "" {
			idx, action, err := ParseSelection(s.o.Select, len(list))
			if err != nil || action != "" {
				return nil, fmt.Errorf("--select geçersiz: %q", s.o.Select)
			}
			return pick(list, idx), nil
		}
		if s.o.All {
			var out []discovery.Printer
			for _, p := range list {
				if eligible(p) {
					out = append(out, p)
				}
			}
			if len(out) == 0 {
				return nil, fmt.Errorf("eşleştirilecek desteklenen yeni yazıcı bulunamadı")
			}
			return out, nil
		}
		var fresh []discovery.Printer
		for _, p := range list {
			if eligible(p) {
				fresh = append(fresh, p)
			}
		}
		if !s.o.Interactive {
			if len(fresh) == 1 && (fresh[0].NeedsSecret == "" || s.secretFromFlags(fresh[0]) != "" || s.cloud[fresh[0].Serial] != "" || (s.o.SlicerCodes == "use" && fresh[0].SecretAvailable)) {
				s.say("Tek uygun yazıcı otomatik seçildi: %s %s\n", fresh[0].VendorLabel, fresh[0].Host)
				return fresh, nil
			}
			if len(fresh) == 0 {
				return nil, fmt.Errorf("%w: eşleştirilecek yazıcı bulunamadı (farklı alt ağdaysa --host IP verin)", ErrNeedsInteraction)
			}
			return nil, fmt.Errorf("%w: %d aday var veya sır gerekli; --select N / --all / --access-code ile tekrar çalıştırın", ErrNeedsInteraction, len(fresh))
		}
		prompt := "Seçim [1,3 = numaralar, a = tümü, m = elle IP, r = yeniden tara, q = çık]: "
		if len(fresh) == 1 && len(list) == 1 {
			prompt = "Seçim [Enter/1 = bu yazıcı, m = elle IP, r = yeniden tara, q = çık]: "
		}
		ans, err := s.ask(prompt)
		if err != nil {
			return nil, err
		}
		if ans == "" && len(fresh) == 1 {
			return fresh, nil
		}
		idx, action, err := ParseSelection(ans, len(list))
		if err != nil {
			s.say("%v\n", err)
			continue
		}
		switch action {
		case "q":
			return nil, fmt.Errorf("iptal edildi")
		case "r":
			continue
		case "m":
			ip, err := s.ask("Yazıcı IP adresi: ")
			if err != nil {
				return nil, err
			}
			if ip != "" {
				hosts = []string{ip}
				s.o.Host = ip
			}
			continue
		case "a":
			if len(fresh) == 0 {
				s.say("Eşleştirilecek desteklenen yeni yazıcı yok.\n")
				continue
			}
			return fresh, nil
		}
		chosen := pick(list, idx)
		ok := chosen[:0]
		for _, p := range chosen {
			if !p.Supported {
				s.say("%s henüz desteklenmiyor, atlandı.\n", p.VendorLabel)
				continue
			}
			ok = append(ok, p)
		}
		if len(ok) > 0 {
			return ok, nil
		}
	}
}

func pick(list []discovery.Printer, idx []int) []discovery.Printer {
	out := make([]discovery.Printer, 0, len(idx))
	for _, i := range idx {
		out = append(out, list[i])
	}
	return out
}

// ParseSelection "1,3" / "2-4" / "a" / "m" / "r" / "q" → 0 tabanlı indeksler veya eylem.
func ParseSelection(in string, n int) ([]int, string, error) {
	in = strings.ToLower(strings.TrimSpace(in))
	switch in {
	case "a", "q", "m", "r":
		return nil, in, nil
	case "":
		return nil, "", fmt.Errorf("seçim boş")
	}
	seen := map[int]bool{}
	var out []int
	for _, part := range strings.FieldsFunc(in, func(r rune) bool { return r == ',' || r == ' ' }) {
		lo, hi := part, part
		if a, b, ok := strings.Cut(part, "-"); ok {
			lo, hi = a, b
		}
		x, err1 := strconv.Atoi(lo)
		y, err2 := strconv.Atoi(hi)
		if err1 != nil || err2 != nil || x < 1 || y > n || x > y {
			return nil, "", fmt.Errorf("geçersiz seçim %q (1-%d)", part, n)
		}
		for i := x; i <= y; i++ {
			if !seen[i-1] {
				seen[i-1] = true
				out = append(out, i-1)
			}
		}
	}
	sort.Ints(out)
	return out, "", nil
}

// PrintTable keşif sonuçlarını numaralı tablo olarak yazar.
func PrintTable(w io.Writer, list []discovery.Printer) {
	if len(list) == 0 {
		fmt.Fprintln(w, "Yazıcı bulunamadı. Yazıcı açık ve bu bilgisayarla aynı ağda mı? (Farklı alt ağ: m ile IP girin)")
		return
	}
	fmt.Fprintln(w, "Bulunan yazıcılar:")
	for i, p := range list {
		name := p.Name
		if name == "" {
			name = p.Model
		}
		status := ""
		switch {
		case p.Paired:
			status = " [zaten eşleşmiş]"
		case !p.Supported:
			status = " [desteklenmiyor]"
		case p.NeedsSecret != "" && p.SecretAvailable:
			status = " [erişim kodu bulundu]"
		case p.NeedsSecret != "":
			status = " [" + secretLabel(p.NeedsSecret) + " sorulacak]"
		}
		id := p.Serial
		if id == "" {
			id = p.MAC
		}
		fmt.Fprintf(w, "  %d) %-12s %-15s %-22s %s%s\n", i+1, p.VendorLabel, p.Host, id, name, status)
		for _, n := range p.Notes {
			fmt.Fprintf(w, "       · %s\n", n)
		}
	}
}

func secretLabel(kind string) string {
	switch kind {
	case discovery.SecretBambuAccessCode:
		return "erişim kodu"
	case discovery.SecretPrusaLinkPass:
		return "PrusaLink şifresi"
	case discovery.SecretOctoPrintAPIKey:
		return "OctoPrint onayı"
	case discovery.SecretMoonrakerAPIKey:
		return "Moonraker API anahtarı"
	}
	return kind
}

func (s *session) secretFromFlags(p discovery.Printer) string {
	switch p.Vendor {
	case "bambu":
		return s.o.AccessCode
	case "prusalink":
		return s.o.Password
	case "octoprint", "klipper":
		return s.o.APIKey
	}
	return ""
}

// pairOne sırrı alır, yazıcıda doğrular (3 deneme), pair API'yi çağırır ve config'e yazar.
func (s *session) pairOne(p discovery.Printer, legacy, single bool) error {
	label := p.VendorLabel
	if label == "" {
		label = p.Vendor
	}
	entry := config.PrinterEntry{
		Vendor:           p.Vendor,
		Serial:           discovery.PairingSerial(p),
		Host:             p.Host,
		Label:            firstNonEmpty(s.o.Label, p.Name),
		MAC:              p.MAC,
		Model:            p.Model,
		BambuTLSInsecure: s.o.TLSInsecure,
		LanPort:          firstPositive(s.o.LanPort, p.LanPort),
	}
	if entry.Vendor == "bambu" {
		entry.BambuTLSName = entry.Serial
		entry.LanPort = s.o.LanPort
	}
	if single || legacy {
		entry.AccessCode = s.o.AccessCode
		entry.Password = s.o.Password
		entry.APIKey = s.o.APIKey
	}

	verified, warning, err := s.acquireAndVerify(&entry, p, legacy)
	if err != nil {
		return err
	}

	token := s.cfg.BridgeToken
	res, err := printflow.Pair(printflow.PairRequest{
		BaseURL:      s.o.URL,
		Code:         s.o.Code,
		BridgeToken:  token,
		AgentVersion: s.o.AgentVersion,
		MachineName:  firstNonEmpty(s.o.Name, entry.Label),
		Vendor:       entry.Vendor,
		Serial:       entry.Serial,
		Host:         entry.Host,
		Label:        entry.Label,
		Model:        entry.Model,
	})
	if err != nil {
		return err
	}
	s.cfg.PrintflowURL = res.BaseURL
	s.cfg.BridgeToken = res.BridgeToken
	entry.MachineID = res.MachineID
	s.cfg.UpsertPrinter(entry)
	if err := config.Save(s.cfg); err != nil {
		return err
	}
	s.paired = append(s.paired, pairedOut{
		MachineID: res.MachineID, Vendor: entry.Vendor, Serial: entry.Serial, Host: entry.Host,
		Name: entry.Label, Verified: verified, Warning: warning,
	})
	s.say("✓ %s %s eşleştirildi (makine %s)\n", label, entry.Host, res.MachineID)
	return nil
}

func (s *session) acquireAndVerify(e *config.PrinterEntry, p discovery.Printer, legacy bool) (bool, string, error) {
	switch e.Vendor {
	case "bambu":
		if e.AccessCode == "" {
			e.AccessCode = s.cloud[e.Serial]
		}
		if e.AccessCode == "" {
			if code := s.slicer[e.Serial]; code != "" {
				use := s.o.SlicerCodes == "use"
				if !use && s.o.SlicerCodes != "no" && s.o.Interactive {
					ans, err := s.ask(fmt.Sprintf("%s içinde bu yazıcının erişim kodu bulundu. Kullanılsın mı? [E/h]: ", strings.Join(s.sources, "/")))
					if err != nil {
						return false, "", err
					}
					use = ans == "" || strings.HasPrefix(strings.ToLower(ans), "e") || strings.HasPrefix(strings.ToLower(ans), "y")
				}
				if use {
					e.AccessCode = code
				}
			}
		}
	case "prusalink":
		if e.Password == "" {
			pw, err := s.ask(fmt.Sprintf("%s PrusaLink şifresi (yazıcı ekranı → Ayarlar → Ağ → PrusaLink): ", p.Host))
			if err != nil {
				return false, "", err
			}
			e.Password = pw
		}
		if serial, _, err := lanapi.PrusaLinkInfo(e.Host, e.LanPort, e.Password); err == nil && serial != "" && !legacy {
			e.Serial = serial
		}
	case "octoprint":
		if e.APIKey == "" {
			key, err := lanapi.RequestAppKey(s.ctx, e.Host, e.LanPort, "PrintFlow Bridge", func() {
				s.say("OctoPrint arayüzünde PrintFlow Bridge erişim isteğini onaylayın (2 dk)…\n")
			})
			if err != nil {
				if legacy {
					return false, err.Error(), nil
				}
				return false, "", err
			}
			e.APIKey = key
		}
	}

	for attempt := 1; attempt <= 3; attempt++ {
		if e.Vendor == "bambu" && e.AccessCode == "" {
			if attempt == 1 && s.o.Interactive {
				s.say("  Erişim kodu: yazıcı ekranı → Ayarlar → Ağ/WLAN → LAN Only / Access Code (8 karakter).\n")
				s.say("  Kod girmeden: Bambu hesabını PrintFlow panelinde bağlayın (bulut telemetri) veya --bambu-token kullanın.\n")
			}
			code, err := s.ask(fmt.Sprintf("%s erişim kodu: ", e.Host))
			if err != nil {
				return false, "", fmt.Errorf("%w: Bambu erişim kodu gerekli (--access-code)", err)
			}
			e.AccessCode = code
		}
		_, observed, err := poller.Read(*e)
		if err == nil {
			if e.Vendor == "bambu" {
				e.BambuCertSHA256 = observed
			}
			s.say("  %s %s: yazıcıdan yanıt alındı\n", e.Vendor, e.Host)
			return true, "", nil
		}
		if legacy {
			s.say("! Doğrulama başarısız, yine de eşleştiriliyor: %v\n", err)
			return false, err.Error(), nil
		}
		s.say("! %v\n", err)
		if !s.o.Interactive {
			return false, "", err
		}
		msg := strings.ToLower(err.Error())
		switch {
		case e.Vendor == "bambu" && strings.Contains(msg, "erişim kodu"):
			e.AccessCode = ""
		case e.Vendor == "prusalink" && strings.Contains(msg, "şifre"):
			pw, aerr := s.ask("PrusaLink şifresi: ")
			if aerr != nil {
				return false, "", aerr
			}
			e.Password = pw
		case e.Vendor == "klipper" && strings.Contains(msg, "yetki"):
			key, aerr := s.ask("Moonraker API anahtarı (Mainsail/Fluidd → Ayarlar → API Key): ")
			if aerr != nil {
				return false, "", aerr
			}
			e.APIKey = key
		default:
			ans, aerr := s.ask("Yazıcı doğrulanamadı. Yine de eşleştirilsin mi? [e/H]: ")
			if aerr != nil {
				return false, "", aerr
			}
			if strings.HasPrefix(strings.ToLower(ans), "e") || strings.HasPrefix(strings.ToLower(ans), "y") {
				return false, err.Error(), nil
			}
			return false, "", err
		}
	}
	return false, "", fmt.Errorf("3 denemede doğrulanamadı")
}

func firstNonEmpty(v ...string) string {
	for _, s := range v {
		if strings.TrimSpace(s) != "" {
			return strings.TrimSpace(s)
		}
	}
	return ""
}

func firstPositive(v ...int) int {
	for _, n := range v {
		if n > 0 {
			return n
		}
	}
	return 0
}
