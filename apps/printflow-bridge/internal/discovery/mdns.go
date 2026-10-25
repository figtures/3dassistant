package discovery

import (
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"math/rand"
	"net"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	mdnsAddr = "224.0.0.251"
	mdnsPort = 5353
)

const (
	typeA    uint16 = 1
	typePTR  uint16 = 12
	typeTXT  uint16 = 16
	typeAAAA uint16 = 28
	typeSRV  uint16 = 33
	typeANY  uint16 = 255
)

// defaultServiceQueries DNS-SD meta + 3D yazıcı ekosistemlerinin bilinen servis tipleri.
var defaultServiceQueries = []string{
	"_services._dns-sd._udp.local",
	"_moonraker._tcp.local",
	"_octoprint._tcp.local",
	"_prusa-link._tcp.local",
	"_http._tcp.local",
	"_ultimaker._tcp.local",
	"_formlabs_formule._tcp.local",
}

type mdnsQuestion struct {
	Name string
	Type uint16
}

type srvData struct {
	Priority uint16
	Weight   uint16
	Port     uint16
	Target   string
}

// mdnsRecord tek DNS kaydı; TXT'de değersiz anahtarlar "" ile tutulur.
type mdnsRecord struct {
	Name    string
	Type    uint16
	TTL     uint32
	Section string
	PTR     string
	A       string
	SRV     *srvData
	TXT     map[string]string
}

type mdnsPacket struct {
	ID         uint16
	IsResponse bool
	Questions  []mdnsQuestion
	Records    []mdnsRecord
}

func encodeName(name string) ([]byte, error) {
	var out []byte
	for _, p := range strings.Split(strings.TrimSuffix(name, "."), ".") {
		if len(p) > 63 {
			return nil, fmt.Errorf("mDNS etiket çok uzun: %s", p)
		}
		out = append(out, byte(len(p)))
		out = append(out, p...)
	}
	return append(out, 0), nil
}

// encodeMdnsQuery sorgu paketi. unicast = QU biti (yanıt doğrudan bize gelsin).
func encodeMdnsQuery(questions []mdnsQuestion, id uint16, unicast bool) ([]byte, error) {
	buf := make([]byte, 12)
	binary.BigEndian.PutUint16(buf[0:], id)
	binary.BigEndian.PutUint16(buf[4:], uint16(len(questions)))
	for _, q := range questions {
		n, err := encodeName(q.Name)
		if err != nil {
			return nil, err
		}
		t := q.Type
		if t == 0 {
			t = typePTR
		}
		class := uint16(0x0001)
		if unicast {
			class |= 0x8000
		}
		buf = append(buf, n...)
		buf = binary.BigEndian.AppendUint16(buf, t)
		buf = binary.BigEndian.AppendUint16(buf, class)
	}
	return buf, nil
}

func readName(buf []byte, offset int) (string, int, error) {
	var labels []string
	pos := offset
	jumped := false
	end := offset
	for guard := 0; guard < 128; guard++ {
		if pos >= len(buf) {
			return "", 0, errors.New("mDNS ad taşması")
		}
		l := int(buf[pos])
		if l == 0 {
			if !jumped {
				end = pos + 1
			}
			return strings.Join(labels, "."), end, nil
		}
		if l&0xc0 == 0xc0 {
			if pos+1 >= len(buf) {
				return "", 0, errors.New("mDNS işaretçi taşması")
			}
			ptr := (l&0x3f)<<8 | int(buf[pos+1])
			if !jumped {
				end = pos + 2
			}
			jumped = true
			if ptr >= len(buf) {
				return "", 0, errors.New("mDNS geçersiz işaretçi")
			}
			pos = ptr
			continue
		}
		if pos+1+l > len(buf) {
			return "", 0, errors.New("mDNS etiket taşması")
		}
		labels = append(labels, string(buf[pos+1:pos+1+l]))
		pos += 1 + l
	}
	return "", 0, errors.New("mDNS işaretçi döngüsü")
}

func parseTxt(buf []byte, start, end int) map[string]string {
	out := map[string]string{}
	p := start
	for p < end {
		l := int(buf[p])
		s := string(buf[p+1 : min(end, p+1+l)])
		p += 1 + l
		if s == "" {
			continue
		}
		if k, v, ok := strings.Cut(s, "="); ok {
			out[strings.ToLower(k)] = v
		} else {
			out[strings.ToLower(s)] = ""
		}
	}
	return out
}

// decodeMdnsPacket mDNS / DNS yanıt paketi → kayıtlar (bozuk paket hata döner).
func decodeMdnsPacket(buf []byte) (*mdnsPacket, error) {
	if len(buf) < 12 {
		return nil, errors.New("mDNS paket kısa")
	}
	be := binary.BigEndian
	pkt := &mdnsPacket{ID: be.Uint16(buf[0:]), IsResponse: be.Uint16(buf[2:])&0x8000 != 0}
	qd := int(be.Uint16(buf[4:]))
	an := int(be.Uint16(buf[6:]))
	total := an + int(be.Uint16(buf[8:])) + int(be.Uint16(buf[10:]))
	off := 12
	for range qd {
		name, end, err := readName(buf, off)
		if err != nil {
			return nil, err
		}
		if end+4 > len(buf) {
			return nil, errors.New("mDNS soru taşması")
		}
		pkt.Questions = append(pkt.Questions, mdnsQuestion{Name: name, Type: be.Uint16(buf[end:])})
		off = end + 4
	}
	for i := range total {
		name, end, err := readName(buf, off)
		if err != nil {
			return nil, err
		}
		if end+10 > len(buf) {
			return nil, errors.New("mDNS kayıt taşması")
		}
		r := mdnsRecord{Name: name, Type: be.Uint16(buf[end:]), TTL: be.Uint32(buf[end+4:]), Section: "additional"}
		if i < an {
			r.Section = "answer"
		}
		rdlen := int(be.Uint16(buf[end+8:]))
		rstart := end + 10
		rend := rstart + rdlen
		if rend > len(buf) {
			return nil, errors.New("mDNS rdata taşması")
		}
		switch {
		case r.Type == typePTR:
			n, _, err := readName(buf, rstart)
			if err != nil {
				return nil, err
			}
			r.PTR = n
		case r.Type == typeA && rdlen == 4:
			r.A = net.IP(buf[rstart:rend]).String()
		case r.Type == typeSRV && rdlen >= 7:
			target, _, err := readName(buf, rstart+6)
			if err != nil {
				return nil, err
			}
			r.SRV = &srvData{
				Priority: be.Uint16(buf[rstart:]),
				Weight:   be.Uint16(buf[rstart+2:]),
				Port:     be.Uint16(buf[rstart+4:]),
				Target:   target,
			}
		case r.Type == typeTXT:
			r.TXT = parseTxt(buf, rstart, rend)
		}
		pkt.Records = append(pkt.Records, r)
		off = rend
	}
	return pkt, nil
}

// encodeMdnsResponse yanıt paketi oluşturur (test ve yerel simülasyon için).
func encodeMdnsResponse(records []mdnsRecord, id uint16) ([]byte, error) {
	buf := make([]byte, 12)
	be := binary.BigEndian
	be.PutUint16(buf[0:], id)
	be.PutUint16(buf[2:], 0x8400)
	be.PutUint16(buf[6:], uint16(len(records)))
	for _, r := range records {
		var rdata []byte
		var err error
		switch r.Type {
		case typePTR:
			rdata, err = encodeName(r.PTR)
		case typeA:
			rdata = net.ParseIP(r.A).To4()
		case typeSRV:
			rdata = be.AppendUint16(nil, r.SRV.Priority)
			rdata = be.AppendUint16(rdata, r.SRV.Weight)
			rdata = be.AppendUint16(rdata, r.SRV.Port)
			var t []byte
			t, err = encodeName(r.SRV.Target)
			rdata = append(rdata, t...)
		case typeTXT:
			for k, v := range r.TXT {
				s := k
				if v != "" {
					s = k + "=" + v
				}
				rdata = append(rdata, byte(len(s)))
				rdata = append(rdata, s...)
			}
		}
		if err != nil {
			return nil, err
		}
		n, err := encodeName(r.Name)
		if err != nil {
			return nil, err
		}
		ttl := r.TTL
		if ttl == 0 {
			ttl = 120
		}
		buf = append(buf, n...)
		buf = be.AppendUint16(buf, r.Type)
		buf = be.AppendUint16(buf, 1)
		buf = be.AppendUint32(buf, ttl)
		buf = be.AppendUint16(buf, uint16(len(rdata)))
		buf = append(buf, rdata...)
	}
	return buf, nil
}

type vendorPattern struct {
	vendor string
	re     *regexp.Regexp
}

var vendorPatterns = []vendorPattern{
	{"bambu", regexp.MustCompile(`(?i)bambu|bbl`)},
	{"creality", regexp.MustCompile(`(?i)creality|\bk1\b|k1c|k1max|\bk2\b|ender-?3 ?v3`)},
	{"elegoo", regexp.MustCompile(`(?i)elegoo|centauri`)},
	{"anycubic", regexp.MustCompile(`(?i)anycubic|kobra`)},
	{"flashforge", regexp.MustCompile(`(?i)flashforge|adventurer|creator ?\d`)},
	{"snapmaker", regexp.MustCompile(`(?i)snapmaker`)},
	{"prusalink", regexp.MustCompile(`(?i)prusa`)},
	{"octoprint", regexp.MustCompile(`(?i)octoprint`)},
	{"klipper", regexp.MustCompile(`(?i)moonraker|klipper|mainsail|fluidd`)},
	{"ultimaker", regexp.MustCompile(`(?i)ultimaker`)},
	{"formlabs", regexp.MustCompile(`(?i)formlabs|formule`)},
}

func vendorHintFromText(text string) string {
	for _, p := range vendorPatterns {
		if p.re.MatchString(text) {
			return p.vendor
		}
	}
	return ""
}

func instanceLabel(fullName, serviceType string) string {
	if strings.HasSuffix(fullName, "."+serviceType) {
		return fullName[:len(fullName)-len(serviceType)-1]
	}
	return fullName
}

var crealityServiceRe = regexp.MustCompile(`(?i)_creality-([0-9a-z]{6,32})\._(?:udp|tcp)`)

// CrealityIDFromService Creality OS servis adı cihaz kimliğini taşır: `_Creality-2657712810F9A7._udp.local`.
func CrealityIDFromService(name string) string {
	m := crealityServiceRe.FindStringSubmatch(name)
	if m == nil {
		return ""
	}
	return strings.ToUpper(m[1])
}

// candidatesFromMdnsRecords bir yanıtlayıcının (IP) mDNS kayıtları → aday listesi.
// Moonraker/OctoPrint/PrusaLink tip bazında; diğerleri ad/tip metninde marka araması ile.
func candidatesFromMdnsRecords(records []mdnsRecord, senderIP string) ([]candidate, []string) {
	srv := map[string]*srvData{}
	txt := map[string]map[string]string{}
	aRec := map[string]string{}
	for _, r := range records {
		switch r.Type {
		case typeSRV:
			srv[r.Name] = r.SRV
		case typeTXT:
			txt[r.Name] = r.TXT
		case typeA:
			aRec[r.Name] = r.A
		}
	}
	var out []candidate
	var serviceTypes []string
	for _, p := range records {
		if p.Type != typePTR {
			continue
		}
		if p.Name == "_services._dns-sd._udp.local" {
			serviceTypes = append(serviceTypes, p.PTR)
			if v := vendorHintFromText(p.PTR); v != "" {
				serial := ""
				if v == "creality" {
					serial = CrealityIDFromService(p.PTR)
				}
				out = append(out, candidate{
					Vendor:     v,
					Host:       senderIP,
					Serial:     serial,
					Methods:    []string{"mdns"},
					Confidence: 0.5,
					Extra:      map[string]any{"mdnsService": p.PTR},
				})
			}
			continue
		}
		typ := p.Name
		instance := p.PTR
		label := instanceLabel(instance, typ)
		s := srv[instance]
		t := txt[instance]
		if t == nil {
			t = map[string]string{}
		}
		host := senderIP
		if s != nil && aRec[s.Target] != "" {
			host = aRec[s.Target]
		}
		var vendor string
		typed := true
		switch {
		case strings.HasPrefix(typ, "_moonraker._tcp"):
			vendor = "klipper"
		case strings.HasPrefix(typ, "_octoprint._tcp"):
			vendor = "octoprint"
		case strings.HasPrefix(typ, "_prusa-link._tcp"):
			vendor = "prusalink"
		case strings.HasPrefix(typ, "_ultimaker._tcp"):
			vendor = "ultimaker"
		case strings.HasPrefix(typ, "_formlabs"):
			vendor = "formlabs"
		default:
			typed = false
			vals := make([]string, 0, len(t))
			for _, v := range t {
				vals = append(vals, v)
			}
			vendor = vendorHintFromText(label + " " + typ + " " + strings.Join(vals, " "))
		}
		if vendor == "" {
			continue
		}
		conf := 0.7
		if strings.HasPrefix(typ, "_http._tcp") {
			conf = 0.5
		}
		lanPort := 0
		// Marka ipucu servisleri (ör. _Creality-…._udp) cihazın API portunu taşımaz.
		if s != nil && (typed || strings.HasPrefix(typ, "_http._tcp")) {
			lanPort = int(s.Port)
		}
		txtCopy := map[string]any{}
		for k, v := range t {
			txtCopy[k] = v
		}
		serial := pick(t["serial"], pick(t["sn"], t["uuid"]))
		if serial == "" && vendor == "creality" {
			serial = CrealityIDFromService(typ)
		}
		out = append(out, candidate{
			Vendor:     vendor,
			Host:       host,
			Serial:     serial,
			Model:      pick(t["model"], t["printer_type"]),
			Name:       label,
			LanPort:    lanPort,
			Methods:    []string{"mdns"},
			Confidence: conf,
			Extra:      map[string]any{"mdnsService": typ, "mdnsInstance": instance, "txt": txtCopy},
		})
	}
	return out, serviceTypes
}

// discoverMdns her arayüzden 224.0.0.251:5353'e sorgu; geçici porttan gönderildiği için yanıtlayıcılar
// RFC 6762 §6.7 gereği doğrudan bize (unicast) yanıt verir — 5353'ü bağlamaya gerek yok.
func discoverMdns(ctx context.Context, timeout time.Duration, ifaces []Interface) methodResult {
	res := methodResult{Method: "mdns", Errors: []string{}}
	var mu sync.Mutex
	byHost := map[string][]mdnsRecord{}
	var hostOrder []string
	learned := map[string]bool{}
	var learnedOrder []string

	addrs := []string{""}
	if len(ifaces) > 0 {
		addrs = addrs[:0]
		for _, i := range ifaces {
			addrs = append(addrs, i.Address)
		}
	}
	deadline := time.Now().Add(timeout)
	var sockets []*net.UDPConn
	var waits []func()
	for _, a := range addrs {
		ip := net.ParseIP(a)
		conn, err := listenUDP4(ip, 0, true)
		if err != nil {
			label := a
			if label == "" {
				label = "varsayılan"
			}
			res.Errors = append(res.Errors, fmt.Sprintf("mDNS soketi açılamadı (%s)", label))
			continue
		}
		if ip != nil {
			setMulticastInterface(conn, ip)
		}
		sockets = append(sockets, conn)
		waits = append(waits, readLoop(conn, deadline, func(b []byte, from *net.UDPAddr) {
			pkt, err := decodeMdnsPacket(b)
			if err != nil || !pkt.IsResponse {
				return
			}
			h := from.IP.String()
			mu.Lock()
			defer mu.Unlock()
			if _, ok := byHost[h]; !ok {
				hostOrder = append(hostOrder, h)
			}
			byHost[h] = append(byHost[h], pkt.Records...)
			for _, r := range pkt.Records {
				if r.Type == typePTR && r.Name == "_services._dns-sd._udp.local" && !learned[r.PTR] {
					learned[r.PTR] = true
					learnedOrder = append(learnedOrder, r.PTR)
				}
			}
		}))
	}
	if len(sockets) == 0 {
		return res
	}
	dst := &net.UDPAddr{IP: net.ParseIP(mdnsAddr), Port: mdnsPort}
	send := func(names []string) {
		qs := make([]mdnsQuestion, len(names))
		for i, n := range names {
			qs[i] = mdnsQuestion{Name: n, Type: typePTR}
		}
		pkt, err := encodeMdnsQuery(qs, uint16(rand.Intn(0xffff)), true)
		if err != nil {
			return
		}
		for _, s := range sockets {
			_, _ = s.WriteToUDP(pkt, dst)
		}
	}
	send(defaultServiceQueries)
	sleepCtx(ctx, timeout/3)
	if ctx.Err() == nil {
		mu.Lock()
		var follow []string
		for _, t := range learnedOrder {
			if vendorHintFromText(t) != "" && !contains(defaultServiceQueries, t) {
				follow = append(follow, t)
			}
		}
		mu.Unlock()
		if len(follow) > 20 {
			follow = follow[:20]
		}
		if len(follow) > 0 {
			send(follow)
		}
		send(defaultServiceQueries)
	}
	sleepCtx(ctx, time.Until(deadline))
	for _, s := range sockets {
		s.Close()
	}
	for _, w := range waits {
		w()
	}
	for _, h := range hostOrder {
		c, _ := candidatesFromMdnsRecords(byHost[h], h)
		res.Candidates = append(res.Candidates, c...)
	}
	return res
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}
