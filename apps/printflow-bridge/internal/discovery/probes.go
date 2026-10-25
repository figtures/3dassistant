package discovery

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// ScanPorts bilinen yerel API portları → parmak izi probu. Tarama yalnızca bunlara bakar.
var ScanPorts = []int{8883, 9999, 3030, 8899, 7125, 80, 5000, 6000, 8080}

type httpResp struct {
	Status int
	Header http.Header
	Body   string
	JSON   map[string]any
}

func httpGet(ctx context.Context, host string, port int, path string, timeout time.Duration, headers map[string]string) *httpResp {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("http://%s%s", net.JoinHostPort(host, strconv.Itoa(port)), path), nil)
	if err != nil {
		return nil
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	client := &http.Client{
		Timeout:       timeout,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	res, err := client.Do(req)
	if err != nil {
		return nil
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(res.Body, 512*1024))
	r := &httpResp{Status: res.StatusCode, Header: res.Header, Body: string(b)}
	_ = json.Unmarshal(b, &r.JSON)
	return r
}

// FingerprintSHA256 sertifika DER → "AA:BB:…" (Node fingerprint256 biçimi).
func FingerprintSHA256(der []byte) string {
	sum := sha256.Sum256(der)
	parts := make([]string, len(sum))
	for i, b := range sum {
		parts[i] = fmt.Sprintf("%02X", b)
	}
	return strings.Join(parts, ":")
}

var (
	serialLikeRe = regexp.MustCompile(`^[0-9A-Z]{8,20}$`)
	bambuIssuer  = regexp.MustCompile(`(?i)bambu|bbl`)
)

// probeBambuTls Bambu: 8883 TLS sertifika CN = yazıcı seri numarası.
func probeBambuTls(ctx context.Context, host string, timeout time.Duration) *candidate {
	d := &tls.Dialer{
		NetDialer: &net.Dialer{Timeout: timeout},
		Config:    &tls.Config{InsecureSkipVerify: true}, //nolint:gosec // yalnızca parmak izi okunur
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	conn, err := d.DialContext(ctx, "tcp", net.JoinHostPort(host, "8883"))
	if err != nil {
		return nil
	}
	defer conn.Close()
	certs := conn.(*tls.Conn).ConnectionState().PeerCertificates
	if len(certs) == 0 {
		return nil
	}
	cert := certs[0]
	cn := cert.Subject.CommonName
	issuer := strings.Join(cert.Issuer.Organization, " ") + " " + cert.Issuer.CommonName
	serialLike := serialLikeRe.MatchString(cn)
	isBambu := bambuIssuer.MatchString(issuer)
	if !serialLike && !isBambu {
		return nil
	}
	c := &candidate{
		Vendor:     "bambu",
		Host:       host,
		Methods:    []string{"tls-probe"},
		Confidence: 0.7,
		Extra:      map[string]any{"certSha256": FingerprintSHA256(cert.Raw)},
	}
	if serialLike {
		c.Serial = cn
		if isBambu {
			c.Confidence = 0.9
		}
	}
	return c
}

var crealityKeys = []string{"nozzleTemp", "bedTemp0", "printProgress", "deviceState", "modelVersion", "boxTemp", "printFileName"}

var crealityRe = regexp.MustCompile(`(?i)creality`)

func crealityFromWsMessage(j map[string]any, host string) *candidate {
	if j == nil {
		return nil
	}
	hasKey := false
	for _, k := range crealityKeys {
		if _, ok := j[k]; ok {
			hasKey = true
			break
		}
	}
	if !hasKey {
		b, _ := json.Marshal(j)
		if len(b) > 2000 {
			b = b[:2000]
		}
		if !crealityRe.Match(b) {
			return nil
		}
	}
	return &candidate{
		Vendor:     "creality",
		Host:       host,
		Serial:     cleanSerial(anyStr(firstNonNil(j, "sn", "SN", "deviceSn", "serial", "deviceId"))),
		MAC:        normalizeMac(anyStr(firstNonNil(j, "mac", "macAddress"))),
		Model:      anyStr(firstNonNil(j, "model", "modelVersion")),
		Name:       anyStr(firstNonNil(j, "hostname", "deviceName")),
		LanPort:    9999,
		Methods:    []string{"ws-probe"},
		Confidence: 0.85,
		Extra:      map[string]any{},
	}
}

type wsResult struct {
	Opened  bool
	Message map[string]any
}

func wsFirstMessage(ctx context.Context, url string, timeout time.Duration, send []any) *wsResult {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	dialer := websocket.Dialer{HandshakeTimeout: timeout}
	conn, _, err := dialer.DialContext(ctx, url, nil)
	if err != nil {
		return nil
	}
	defer conn.Close()
	for _, m := range send {
		_ = conn.WriteJSON(m)
	}
	dl, _ := ctx.Deadline()
	_ = conn.SetReadDeadline(dl)
	_, data, err := conn.ReadMessage()
	if err != nil {
		return &wsResult{Opened: true}
	}
	var j map[string]any
	_ = json.Unmarshal(data, &j)
	return &wsResult{Opened: true, Message: j}
}

func probeCrealityWs(ctx context.Context, host string, port int) *candidate {
	r := wsFirstMessage(ctx, fmt.Sprintf("ws://%s/", net.JoinHostPort(host, strconv.Itoa(port))), 3500*time.Millisecond, []any{
		map[string]string{"mode": "subscribe", "topic": "print"},
		map[string]string{"mode": "subscribe", "topic": "status"},
	})
	if r == nil || r.Message == nil {
		return nil
	}
	return crealityFromWsMessage(r.Message, host)
}

var unknownSerial = regexp.MustCompile(`(?i)unknown|^0+$`)

// probeMoonraker Moonraker (Klipper): /printer/info + /machine/system_info → MAC/seri.
func probeMoonraker(ctx context.Context, host string, port int) *candidate {
	info := httpGet(ctx, host, port, "/printer/info", 2500*time.Millisecond, nil)
	if info == nil {
		return nil
	}
	if info.Status == 401 || info.Status == 403 {
		return &candidate{
			Vendor: "klipper", Host: host, LanPort: port, Methods: []string{"http-probe"},
			Confidence: 0.6, AuthRequired: true, Extra: map[string]any{},
		}
	}
	r := asMap(info.JSON["result"])
	if r == nil || (r["state"] == nil && r["klipper_path"] == nil && r["software_version"] == nil) {
		return nil
	}
	var sys map[string]any
	if si := httpGet(ctx, host, port, "/machine/system_info", 2500*time.Millisecond, nil); si != nil {
		sys = asMap(asMap(si.JSON["result"])["system_info"])
	}
	mac := ""
	network := asMap(sys["network"])
	names := make([]string, 0, len(network))
	for k := range network {
		names = append(names, k)
	}
	sort.Strings(names)
	for _, n := range names {
		if mac = normalizeMac(anyStr(asMap(network[n])["mac_address"])); mac != "" {
			break
		}
	}
	cpu := asMap(sys["cpu_info"])
	serial := mac
	if serial == "" {
		if cs, ok := cpu["serial_number"].(string); ok && cs != "" && !unknownSerial.MatchString(cs) {
			serial = cs
		}
	}
	product := asMap(sys["product_info"])
	model := anyStr(firstNonNil(product, "machine_type", "device_name"))
	if model == "" {
		model = anyStr(cpu["model"])
	}
	extra := map[string]any{}
	setExtra(extra, "klippyState", anyStr(r["state"]))
	setExtra(extra, "software", anyStr(r["software_version"]))
	return &candidate{
		Vendor:     "klipper",
		Host:       host,
		Serial:     serial,
		MAC:        mac,
		Model:      model,
		Name:       anyStr(r["hostname"]),
		LanPort:    port,
		Methods:    []string{"http-probe"},
		Confidence: 0.9,
		Extra:      extra,
	}
}

var (
	prusaTextRe = regexp.MustCompile(`(?i)printer api|prusa`)
	prusaRe     = regexp.MustCompile(`(?i)prusa`)
	octoRe      = regexp.MustCompile(`(?i)octoprint`)
)

// probeHttpPrinter OctoPrint (appkeys probe 204) veya PrusaLink (Digest realm "Printer API").
func probeHttpPrinter(ctx context.Context, host string, port int) *candidate {
	if ak := httpGet(ctx, host, port, "/plugin/appkeys/probe", 2500*time.Millisecond, nil); ak != nil && ak.Status == 204 {
		return &candidate{Vendor: "octoprint", Host: host, LanPort: port, Methods: []string{"http-probe"}, Confidence: 0.9, Extra: map[string]any{}}
	}
	ver := httpGet(ctx, host, port, "/api/version", 2500*time.Millisecond, nil)
	if ver == nil {
		return nil
	}
	auth := ver.Header.Get("WWW-Authenticate")
	text := anyStr(ver.JSON["text"]) + " " + anyStr(ver.JSON["server"]) + " " + auth
	printer, _ := ver.JSON["printer"].(string)
	if prusaTextRe.MatchString(text) || (printer != "" && prusaRe.MatchString(printer)) {
		return &candidate{
			Vendor:       "prusalink",
			Host:         host,
			Model:        printer,
			Name:         anyStr(ver.JSON["hostname"]),
			LanPort:      port,
			Methods:      []string{"http-probe"},
			Confidence:   0.85,
			AuthRequired: ver.Status == 401,
			Extra:        map[string]any{},
		}
	}
	if ver.JSON["server"] != nil && anyStr(ver.JSON["server"]) != "" && octoRe.MatchString(anyStr(ver.JSON["text"])) {
		return &candidate{Vendor: "octoprint", Host: host, LanPort: port, Methods: []string{"http-probe"}, Confidence: 0.85, Extra: map[string]any{}}
	}
	return nil
}

var ffDoneRe = regexp.MustCompile(`(?is)M115.*ok`)

func latin1(b []byte) string {
	r := make([]rune, len(b))
	for i, c := range b {
		r[i] = rune(c)
	}
	return string(r)
}

// probeFlashforgeTcp Flashforge TCP 8899: `~M601 S1` (kontrol) → `~M115` → `~M602` (bırak).
func probeFlashforgeTcp(ctx context.Context, host string, port int, timeout time.Duration) *candidate {
	d := net.Dialer{Timeout: timeout}
	conn, err := d.DialContext(ctx, "tcp", net.JoinHostPort(host, strconv.Itoa(port)))
	if err != nil {
		return nil
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(timeout))
	_, _ = conn.Write([]byte("~M601 S1\r\n"))
	time.Sleep(150 * time.Millisecond)
	_, _ = conn.Write([]byte("~M115\r\n"))
	var buf []byte
	tmp := make([]byte, 4096)
	for {
		n, err := conn.Read(tmp)
		buf = append(buf, tmp[:n]...)
		if ffDoneRe.MatchString(latin1(buf)) {
			_, _ = conn.Write([]byte("~M602\r\n"))
			time.Sleep(100 * time.Millisecond)
			break
		}
		if err != nil {
			break
		}
	}
	info := ParseFlashforgeM115(latin1(buf))
	if info == nil {
		return nil
	}
	extra := map[string]any{}
	setExtra(extra, "firmware", info.Firmware)
	return &candidate{
		Vendor:     "flashforge",
		Host:       host,
		Serial:     info.Serial,
		MAC:        normalizeMac(info.MAC),
		Model:      info.MachineType,
		Name:       info.MachineName,
		LanPort:    8899,
		Methods:    []string{"tcp-probe"},
		Confidence: 0.95,
		Extra:      extra,
	}
}

func probeAnycubicWs(ctx context.Context, host string, port int) *candidate {
	r := wsFirstMessage(ctx, fmt.Sprintf("ws://%s/", net.JoinHostPort(host, strconv.Itoa(port))), 2500*time.Millisecond, nil)
	if r == nil || !r.Opened {
		return nil
	}
	c := &candidate{Vendor: "anycubic", Host: host, LanPort: port, Methods: []string{"ws-probe"}, Confidence: 0.4, Extra: map[string]any{}}
	if r.Message != nil {
		c.Serial = anyStr(firstNonNil(r.Message, "sn", "deviceId"))
		c.Model = anyStr(r.Message["model"])
		c.Name = anyStr(r.Message["name"])
		c.Confidence = 0.6
	}
	return c
}

func firstSdcp(ctx context.Context, host string) *candidate {
	r := discoverSdcp(ctx, 1200*time.Millisecond, nil, []string{host})
	if len(r.Candidates) == 0 {
		return nil
	}
	return &r.Candidates[0]
}

func firstSnapmaker(ctx context.Context, host string) *candidate {
	r := discoverSnapmaker(ctx, 1200*time.Millisecond, nil, []string{host})
	if len(r.Candidates) == 0 {
		return nil
	}
	return &r.Candidates[0]
}

// portProbes açık port → olası prob.
var portProbes = map[int]func(context.Context, string) *candidate{
	8883: func(ctx context.Context, h string) *candidate { return probeBambuTls(ctx, h, 3*time.Second) },
	9999: func(ctx context.Context, h string) *candidate { return probeCrealityWs(ctx, h, 9999) },
	3030: firstSdcp,
	8899: func(ctx context.Context, h string) *candidate {
		return probeFlashforgeTcp(ctx, h, 8899, 2500*time.Millisecond)
	},
	7125: func(ctx context.Context, h string) *candidate { return probeMoonraker(ctx, h, 7125) },
	80:   func(ctx context.Context, h string) *candidate { return probeHttpPrinter(ctx, h, 80) },
	5000: func(ctx context.Context, h string) *candidate { return probeHttpPrinter(ctx, h, 5000) },
	6000: func(ctx context.Context, h string) *candidate { return probeAnycubicWs(ctx, h, 6000) },
	8080: firstSnapmaker,
}

type probeResult struct {
	OpenPorts  []int
	Candidates []candidate
}

// probeHost tek host: bilinen portları yoklar, açık olanlarda marka parmak izi çalıştırır.
// openPorts nil ise portlar önce yoklanır ve UDP-only (SDCP, Snapmaker) unicast sorguları da yapılır.
func probeHost(ctx context.Context, host string, openPorts []int, timeout time.Duration) probeResult {
	scanned := openPorts == nil
	open := openPorts
	if scanned {
		flags := mapLimit(ScanPorts, len(ScanPorts), func(p int, _ int) bool { return tcpOpen(ctx, host, p, timeout) })
		open = []int{}
		for i, ok := range flags {
			if ok {
				open = append(open, ScanPorts[i])
			}
		}
	}
	var jobs []func() *candidate
	for _, p := range open {
		if fn, ok := portProbes[p]; ok {
			jobs = append(jobs, func() *candidate { return fn(ctx, host) })
		}
	}
	if scanned {
		if !containsInt(open, 3030) {
			jobs = append(jobs, func() *candidate { return firstSdcp(ctx, host) })
		}
		if !containsInt(open, 8080) {
			jobs = append(jobs, func() *candidate { return firstSnapmaker(ctx, host) })
		}
	}
	results := make([]*candidate, len(jobs))
	var wg sync.WaitGroup
	for i, j := range jobs {
		wg.Add(1)
		go func() {
			defer wg.Done()
			results[i] = j()
		}()
	}
	wg.Wait()
	res := probeResult{OpenPorts: open}
	for _, c := range results {
		if c != nil {
			res.Candidates = append(res.Candidates, *c)
		}
	}
	return res
}

func containsInt(list []int, v int) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

func portOr(p, def int) int {
	if p > 0 {
		return p
	}
	return def
}

// verifyCandidate mDNS/UDP ile bulunan ama serisi eksik adaylar için doğrulama probu.
func verifyCandidate(ctx context.Context, c candidate) *candidate {
	switch c.Vendor {
	case "bambu":
		if c.Serial != "" {
			return nil
		}
		return probeBambuTls(ctx, c.Host, 3*time.Second)
	case "creality":
		return probeCrealityWs(ctx, c.Host, portOr(c.LanPort, 9999))
	case "klipper":
		return probeMoonraker(ctx, c.Host, portOr(c.LanPort, 7125))
	case "octoprint", "prusalink":
		return probeHttpPrinter(ctx, c.Host, portOr(c.LanPort, 80))
	case "flashforge":
		return probeFlashforgeTcp(ctx, c.Host, 8899, 2500*time.Millisecond)
	case "elegoo":
		if c.Serial != "" {
			return nil
		}
		return firstSdcp(ctx, c.Host)
	}
	return nil
}
