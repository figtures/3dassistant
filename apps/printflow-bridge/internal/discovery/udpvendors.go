package discovery

import (
	"context"
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const (
	sdcpPort            = 3000
	sdcpProbe           = "M99999"
	snapmakerPort       = 20054
	flashforgeMulticast = "225.0.0.9"
)

var flashforgePorts = []int{19000, 48899}

// anyStr JSON değeri → metin (string / sayı / bool); yoksa "".
func anyStr(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case float64:
		return strconv.FormatFloat(x, 'f', -1, 64)
	case json.Number:
		return x.String()
	case bool:
		return strconv.FormatBool(x)
	}
	return ""
}

// firstNonNil JS `a ?? b ?? c` eşdeğeri.
func firstNonNil(m map[string]any, keys ...string) any {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			return v
		}
	}
	return nil
}

// firstStr JS `a || b || c` eşdeğeri (yalnızca dolu metinler).
func firstStr(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if s := anyStr(m[k]); s != "" {
			return s
		}
	}
	return ""
}

func asMap(v any) map[string]any {
	m, _ := v.(map[string]any)
	return m
}

// parseSdcpResponse Elegoo SDCP (Centauri Carbon, Saturn/Mars v3) `M99999` yanıtı.
func parseSdcpResponse(text, senderIP string) *candidate {
	var j any
	if err := json.Unmarshal([]byte(strings.TrimSpace(text)), &j); err != nil {
		return nil
	}
	root := asMap(j)
	if root == nil {
		return nil
	}
	var dv any
	if data := asMap(root["Data"]); data != nil && data["Attributes"] != nil {
		dv = data["Attributes"]
	} else if root["Data"] != nil {
		dv = root["Data"]
	} else {
		dv = root["Attributes"]
	}
	d := asMap(dv)
	if d == nil {
		return nil
	}
	id := anyStr(firstNonNil(d, "MainboardID", "MainboardId", "mainboardId"))
	if id == "" || id == "0" || id == "false" {
		return nil
	}
	host := senderIP
	if ip := anyStr(d["MainboardIP"]); isIPv4(ip) {
		host = ip
	}
	extra := map[string]any{}
	setExtra(extra, "brand", anyStr(d["BrandName"]))
	setExtra(extra, "protocol", anyStr(d["ProtocolVersion"]))
	setExtra(extra, "firmware", anyStr(d["FirmwareVersion"]))
	return &candidate{
		Vendor:     "elegoo",
		Host:       host,
		Serial:     id,
		Model:      firstStr(d, "MachineName", "Name"),
		Name:       firstStr(d, "Name", "MachineName"),
		LanPort:    3030,
		Methods:    []string{"sdcp"},
		Confidence: 0.95,
		Extra:      extra,
	}
}

var snapmakerRe = regexp.MustCompile(`(?i)snapmaker`)

// parseSnapmakerResponse Snapmaker `discover` yanıtı: `Snapmaker@IP|model:...|status:...|SACP:1`.
func parseSnapmakerResponse(text, senderIP string) *candidate {
	s := strings.TrimSpace(text)
	if !snapmakerRe.MatchString(s) || !strings.Contains(s, "|") {
		return nil
	}
	parts := strings.Split(s, "|")
	head := parts[0]
	name, ip := head, ""
	if at := strings.Index(head, "@"); at > 0 {
		name, ip = head[:at], strings.TrimSpace(head[at+1:])
	}
	fields := map[string]string{}
	for _, part := range parts[1:] {
		if i := strings.Index(part, ":"); i > 0 {
			fields[strings.ToLower(strings.TrimSpace(part[:i]))] = strings.TrimSpace(part[i+1:])
		}
	}
	host := senderIP
	if isIPv4(ip) {
		host = ip
	}
	extra := map[string]any{}
	setExtra(extra, "status", fields["status"])
	setExtra(extra, "sacp", fields["sacp"])
	return &candidate{
		Vendor:     "snapmaker",
		Host:       host,
		Serial:     pick(fields["sn"], fields["serial"]),
		Model:      fields["model"],
		Name:       name,
		Methods:    []string{"snapmaker-udp"},
		Confidence: 0.9,
		Extra:      extra,
	}
}

func printableRuns(buf []byte) []string {
	var runs []string
	var cur strings.Builder
	flush := func() {
		if t := strings.TrimSpace(cur.String()); len(t) >= 3 {
			runs = append(runs, t)
		}
		cur.Reset()
	}
	for _, b := range buf {
		if b >= 0x20 && b < 0x7f {
			cur.WriteByte(b)
		} else {
			flush()
		}
	}
	flush()
	return runs
}

var ffSerialRe = regexp.MustCompile(`(?i)^SN[A-Z0-9]{6,}$`)

// parseFlashforgeUdp Flashforge UDP keşif yanıtı (ikili; sabit ofset yerine savunmacı metin çıkarımı).
func parseFlashforgeUdp(buf []byte, senderIP string) *candidate {
	if len(buf) < 8 {
		return nil
	}
	runs := printableRuns(buf)
	if len(runs) == 0 {
		return nil
	}
	serial := ""
	for _, r := range runs {
		if ffSerialRe.MatchString(r) {
			serial = r
			break
		}
	}
	name := ""
	for _, r := range runs {
		if r != serial {
			name = r
			break
		}
	}
	conf := 0.6
	if serial != "" {
		conf = 0.85
	}
	return &candidate{
		Vendor:     "flashforge",
		Host:       senderIP,
		Serial:     serial,
		Name:       name,
		LanPort:    8899,
		Methods:    []string{"flashforge-udp"},
		Confidence: conf,
		Extra:      map[string]any{},
	}
}

// FlashforgeInfo TCP 8899 `~M115` yanıtı.
type FlashforgeInfo struct {
	MachineType string
	MachineName string
	Firmware    string
	Serial      string
	MAC         string
}

var (
	ffDetectRe = regexp.MustCompile(`(?i)Machine Type|Machine Name|SN:`)
	ffTypeRe   = regexp.MustCompile(`(?i)Machine Type:\s*([^\r\n]+)`)
	ffNameRe   = regexp.MustCompile(`(?i)Machine Name:\s*([^\r\n]+)`)
	ffFwRe     = regexp.MustCompile(`(?i)Firmware:\s*([^\r\n]+)`)
	ffSNRe     = regexp.MustCompile(`(?i)SN:\s*([^\s\r\n]+)`)
	ffMacRe    = regexp.MustCompile(`(?i)Mac Address:\s*([0-9A-Fa-f:.-]{11,17})`)
)

// ParseFlashforgeM115 `~M115` yanıtını çözer; Flashforge değilse nil.
func ParseFlashforgeM115(text string) *FlashforgeInfo {
	if !ffDetectRe.MatchString(text) {
		return nil
	}
	p := func(re *regexp.Regexp) string {
		if m := re.FindStringSubmatch(text); m != nil {
			return strings.TrimSpace(m[1])
		}
		return ""
	}
	return &FlashforgeInfo{
		MachineType: p(ffTypeRe),
		MachineName: p(ffNameRe),
		Firmware:    p(ffFwRe),
		Serial:      p(ffSNRe),
		MAC:         p(ffMacRe),
	}
}

func hostTargets(hosts []string, port int) []udpTarget {
	out := make([]udpTarget, len(hosts))
	for i, h := range hosts {
		out[i] = udpTarget{h, port}
	}
	return out
}

func udpMethod(ctx context.Context, method string, payload []byte, targets []udpTarget, timeout time.Duration, parse func([]byte, string) *candidate) methodResult {
	res := methodResult{Method: method, Errors: []string{}}
	c, err := udpQuery(ctx, payload, targets, timeout, parse)
	if err != nil {
		res.Errors = append(res.Errors, "UDP soketi açılamadı")
	}
	res.Candidates = c
	return res
}

func discoverSdcp(ctx context.Context, timeout time.Duration, ifaces []Interface, hosts []string) methodResult {
	if hosts == nil {
		hosts = broadcastTargets(ifaces)
	}
	return udpMethod(ctx, "sdcp", []byte(sdcpProbe), hostTargets(hosts, sdcpPort), timeout, func(b []byte, ip string) *candidate {
		return parseSdcpResponse(string(b), ip)
	})
}

func discoverSnapmaker(ctx context.Context, timeout time.Duration, ifaces []Interface, hosts []string) methodResult {
	if hosts == nil {
		hosts = broadcastTargets(ifaces)
	}
	return udpMethod(ctx, "snapmaker-udp", []byte("discover"), hostTargets(hosts, snapmakerPort), timeout, func(b []byte, ip string) *candidate {
		return parseSnapmakerResponse(string(b), ip)
	})
}

func discoverFlashforge(ctx context.Context, timeout time.Duration, ifaces []Interface) methodResult {
	var targets []udpTarget
	for _, port := range flashforgePorts {
		targets = append(targets, udpTarget{flashforgeMulticast, port})
		for _, b := range broadcastTargets(ifaces) {
			targets = append(targets, udpTarget{b, port})
		}
	}
	return udpMethod(ctx, "flashforge-udp", make([]byte, 20), targets, timeout, parseFlashforgeUdp)
}
