package discovery

import (
	"context"
	"fmt"
	"net"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// BambuModels Bambu Lab model kodları (DevModel.bambu.com) → okunur ad.
var BambuModels = map[string]string{
	"BL-P001": "X1 Carbon",
	"BL-P002": "X1",
	"C13":     "X1E",
	"C11":     "P1P",
	"C12":     "P1S",
	"N1":      "A1 mini",
	"N2S":     "A1",
	"O1D":     "H2D",
	"N6":      "X2D",
}

var bambuSSDPPorts = []int{2021, 1990}

type ssdpMessage struct {
	StartLine string
	Headers   map[string]string
}

// parseSsdpMessage SSDP/HTTPU mesajı → başlangıç satırı + başlıklar (küçük harf anahtar).
func parseSsdpMessage(text string) ssdpMessage {
	lines := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
	msg := ssdpMessage{Headers: map[string]string{}}
	if len(lines) > 0 {
		msg.StartLine = strings.TrimSpace(lines[0])
		lines = lines[1:]
	}
	for _, line := range lines {
		i := strings.Index(line, ":")
		if i <= 0 {
			continue
		}
		key := strings.ToLower(strings.TrimSpace(line[:i]))
		if _, dup := msg.Headers[key]; key != "" && !dup {
			msg.Headers[key] = strings.TrimSpace(line[i+1:])
		}
	}
	return msg
}

func isBambuMessage(h map[string]string) bool {
	nt := strings.ToLower(h["nt"] + " " + h["st"])
	_, m := h["devmodel.bambu.com"]
	_, n := h["devname.bambu.com"]
	return strings.Contains(nt, "bambulab") || m || n
}

var (
	schemeRe  = regexp.MustCompile(`^https?://`)
	portPathR = regexp.MustCompile(`[:/].*$`)
	uuidRe    = regexp.MustCompile(`(?i)^uuid:`)
)

// bambuCandidateFromSsdp Bambu NOTIFY / M-SEARCH yanıtı → keşif adayı (değilse nil).
func bambuCandidateFromSsdp(text, senderIP string) *candidate {
	h := parseSsdpMessage(text).Headers
	if !isBambuMessage(h) {
		return nil
	}
	location := portPathR.ReplaceAllString(schemeRe.ReplaceAllString(h["location"], ""), "")
	host := senderIP
	if isIPv4(location) {
		host = location
	}
	serial := strings.TrimSpace(strings.Split(uuidRe.ReplaceAllString(h["usn"], ""), "::")[0])
	if host == "" || serial == "" {
		return nil
	}
	modelCode := h["devmodel.bambu.com"]
	model := ""
	if modelCode != "" {
		model = BambuModels[modelCode]
		if model == "" {
			model = modelCode
		}
	}
	extra := map[string]any{}
	setExtra(extra, "modelCode", modelCode)
	setExtra(extra, "connectMode", strings.ToLower(h["devconnect.bambu.com"]))
	setExtra(extra, "bind", strings.ToLower(h["devbind.bambu.com"]))
	setExtra(extra, "firmware", h["devversion.bambu.com"])
	if s, ok := h["devsignal.bambu.com"]; ok {
		if v, err := strconv.ParseFloat(strings.TrimSpace(s), 64); err == nil {
			extra["signalDbm"] = v
		}
	}
	return &candidate{
		Vendor:     "bambu",
		Host:       host,
		Serial:     serial,
		Model:      model,
		Name:       h["devname.bambu.com"],
		Methods:    []string{"ssdp"},
		Confidence: 0.95,
		Extra:      extra,
	}
}

func setExtra(m map[string]any, k, v string) {
	if v != "" {
		m[k] = v
	}
}

var bambuMSearch = strings.Join([]string{
	"M-SEARCH * HTTP/1.1",
	"HOST: 239.255.255.250:1990",
	`MAN: "ssdp:discover"`,
	"MX: 2",
	"ST: urn:bambulab-com:device:3dprinter:1",
	"",
	"",
}, "\r\n")

type methodResult struct {
	Method     string
	Candidates []candidate
	Errors     []string
}

// discoverBambuSsdp Bambu yazıcılar ~5 sn'de bir UDP 2021'e SSDP NOTIFY yayınlar; ayrıca M-SEARCH ile
// tetiklenir. Port meşgulse (Bambu Studio açık) yalnızca M-SEARCH yanıtları dinlenir.
func discoverBambuSsdp(ctx context.Context, timeout time.Duration, ifaces []Interface) methodResult {
	res := methodResult{Method: "ssdp", Errors: []string{}}
	var sockets []*net.UDPConn
	for _, port := range bambuSSDPPorts {
		s, err := listenUDP4(nil, port, true)
		if err != nil {
			res.Errors = append(res.Errors, fmt.Sprintf("UDP %d dinlenemedi (Bambu Studio / OrcaSlicer açık olabilir)", port))
			continue
		}
		sockets = append(sockets, s)
	}
	ephemeral, err := listenUDP4(nil, 0, true)
	if err == nil {
		sockets = append(sockets, ephemeral)
	}
	deadline := time.Now().Add(timeout)
	var mu sync.Mutex
	var waits []func()
	for _, s := range sockets {
		waits = append(waits, readLoop(s, deadline, func(b []byte, from *net.UDPAddr) {
			if c := bambuCandidateFromSsdp(string(b), from.IP.String()); c != nil {
				mu.Lock()
				res.Candidates = append(res.Candidates, *c)
				mu.Unlock()
			}
		}))
	}
	if ephemeral != nil {
		seen := map[string]bool{}
		var targets []udpTarget
		for _, h := range append([]string{"239.255.255.250"}, broadcastTargets(ifaces)...) {
			if seen[h] {
				continue
			}
			seen[h] = true
			for _, port := range bambuSSDPPorts {
				targets = append(targets, udpTarget{h, port})
			}
		}
		sendAll(ephemeral, []byte(bambuMSearch), targets)
		second := min(1500*time.Millisecond, timeout/3)
		sleepCtx(ctx, second)
		if ctx.Err() == nil {
			sendAll(ephemeral, []byte(bambuMSearch), targets)
		}
	}
	sleepCtx(ctx, time.Until(deadline))
	for _, s := range sockets {
		s.Close()
	}
	for _, w := range waits {
		w()
	}
	return res
}
