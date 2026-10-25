package discovery

import (
	"encoding/binary"
	"encoding/json"
	"net"
	"strings"
	"testing"

	"github.com/printflow/printflow-bridge/internal/config"
)

const bambuNotify = "NOTIFY * HTTP/1.1\r\n" +
	"HOST: 239.255.255.250:1900\r\n" +
	"Server: UPnP/1.0\r\n" +
	"Location: 192.168.1.151\r\n" +
	"NT: urn:bambulab-com:device:3dprinter:1\r\n" +
	"USN: 01P00A123456789\r\n" +
	"DevModel.bambu.com: C12\r\n" +
	"DevName.bambu.com: Atolye P1S\r\n" +
	"DevSignal.bambu.com: -48\r\n" +
	"DevConnect.bambu.com: lan\r\n\r\n"

func TestSsdpBambu(t *testing.T) {
	m := parseSsdpMessage(bambuNotify)
	if m.StartLine != "NOTIFY * HTTP/1.1" || m.Headers["devmodel.bambu.com"] != "C12" {
		t.Fatalf("parse: %+v", m)
	}
	c := bambuCandidateFromSsdp(bambuNotify, "192.168.1.99")
	if c == nil || c.Host != "192.168.1.151" || c.Serial != "01P00A123456789" || c.Model != "P1S" || c.Name != "Atolye P1S" {
		t.Fatalf("candidate: %+v", c)
	}
	alt := strings.Replace(strings.Replace(bambuNotify, "Location: 192.168.1.151", "Location: ", 1), "C12", "ZX9", 1)
	c2 := bambuCandidateFromSsdp(alt, "10.0.0.5")
	if c2 == nil || c2.Host != "10.0.0.5" || c2.Model != "ZX9" {
		t.Fatalf("fallback: %+v", c2)
	}
	x2d := bambuCandidateFromSsdp(strings.Replace(bambuNotify, "C12", "N6", 1), "192.168.1.151")
	if x2d == nil || x2d.Model != "X2D" || x2d.Extra["modelCode"] != "N6" {
		t.Fatalf("X2D: %+v", x2d)
	}
	other := "NOTIFY * HTTP/1.1\r\nNT: upnp:rootdevice\r\nUSN: uuid:abc\r\n\r\n"
	if bambuCandidateFromSsdp(other, "192.168.1.1") != nil {
		t.Fatal("non-bambu accepted")
	}
}

func TestMdnsQueryAndRoundTrip(t *testing.T) {
	q, err := encodeMdnsQuery([]mdnsQuestion{{Name: "_moonraker._tcp.local", Type: typePTR}}, 7, true)
	if err != nil {
		t.Fatal(err)
	}
	if binary.BigEndian.Uint16(q[0:]) != 7 || binary.BigEndian.Uint16(q[len(q)-2:])&0x8000 == 0 {
		t.Fatal("header / QU bit")
	}
	pq, err := decodeMdnsPacket(q)
	if err != nil || pq.IsResponse || pq.Questions[0].Name != "_moonraker._tcp.local" {
		t.Fatalf("decode query: %v %+v", err, pq)
	}

	recs := []mdnsRecord{
		{Name: "_moonraker._tcp.local", Type: typePTR, PTR: "Voron._moonraker._tcp.local"},
		{Name: "Voron._moonraker._tcp.local", Type: typeSRV, SRV: &srvData{Port: 7125, Target: "voron.local"}},
		{Name: "Voron._moonraker._tcp.local", Type: typeTXT, TXT: map[string]string{"serial": "ABC123"}},
		{Name: "voron.local", Type: typeA, A: "192.168.1.40"},
	}
	buf, err := encodeMdnsResponse(recs, 0)
	if err != nil {
		t.Fatal(err)
	}
	pkt, err := decodeMdnsPacket(buf)
	if err != nil || !pkt.IsResponse || len(pkt.Records) != 4 {
		t.Fatalf("decode: %v %+v", err, pkt)
	}
	if pkt.Records[1].SRV.Port != 7125 || pkt.Records[3].A != "192.168.1.40" || pkt.Records[2].TXT["serial"] != "ABC123" {
		t.Fatalf("records: %+v", pkt.Records)
	}
	cands, _ := candidatesFromMdnsRecords(pkt.Records, "192.168.1.200")
	if len(cands) != 1 || cands[0].Vendor != "klipper" || cands[0].Host != "192.168.1.40" || cands[0].LanPort != 7125 || cands[0].Serial != "ABC123" {
		t.Fatalf("candidates: %+v", cands)
	}
}

func TestMdnsCompressionAndRejects(t *testing.T) {
	base, _ := encodeMdnsResponse([]mdnsRecord{{Name: "_services._dns-sd._udp.local", Type: typePTR, PTR: "_Creality-AB12CD34._udp.local"}}, 0)
	extra := []byte{0xc0, 12}
	meta := make([]byte, 10)
	binary.BigEndian.PutUint16(meta[0:], typeA)
	binary.BigEndian.PutUint16(meta[2:], 1)
	binary.BigEndian.PutUint32(meta[4:], 60)
	binary.BigEndian.PutUint16(meta[8:], 4)
	buf := append(append(append(base, extra...), meta...), 192, 168, 1, 77)
	binary.BigEndian.PutUint16(buf[6:], 2)
	pkt, err := decodeMdnsPacket(buf)
	if err != nil || pkt.Records[1].Name != "_services._dns-sd._udp.local" || pkt.Records[1].A != "192.168.1.77" {
		t.Fatalf("compression: %v %+v", err, pkt)
	}
	if _, err := decodeMdnsPacket(make([]byte, 5)); err == nil {
		t.Fatal("short packet accepted")
	}
	loop := make([]byte, 14)
	binary.BigEndian.PutUint16(loop[4:], 1)
	loop[12], loop[13] = 0xc0, 12
	if _, err := decodeMdnsPacket(loop); err == nil {
		t.Fatal("pointer loop accepted")
	}
}

// Gerçek K2 Pro yanıtı (canlı ağda gözlendi): servis adı cihaz ID'sini taşır, SRV portu API değildir.
func TestCrealityServiceIDAndPlaceholderSerial(t *testing.T) {
	recs := []mdnsRecord{
		{Name: "_services._dns-sd._udp.local", Type: typePTR, PTR: "_Creality-2657712810F9A7._udp.local"},
		{Name: "_Creality-2657712810F9A7._udp.local", Type: typePTR, PTR: "K2Pro-F9A7._Creality-2657712810F9A7._udp.local"},
		{Name: "K2Pro-F9A7._Creality-2657712810F9A7._udp.local", Type: typeSRV, SRV: &srvData{Port: 5353, Target: "K2Pro-F9A7.local"}},
	}
	cands, _ := candidatesFromMdnsRecords(recs, "192.168.1.148")
	if len(cands) == 0 {
		t.Fatal("no candidates")
	}
	for _, c := range cands {
		if c.Vendor != "creality" || c.Serial != "2657712810F9A7" || c.LanPort != 0 {
			t.Fatalf("creality mdns: %+v", c)
		}
	}
	ws := crealityFromWsMessage(map[string]any{"sn": "SN_XXX", "model": "F012", "hostname": "K2Pro-F9A7", "nozzleTemp": "26.3"}, "192.168.1.148")
	if ws == nil || ws.Serial != "" || ws.Model != "F012" {
		t.Fatalf("ws placeholder: %+v", ws)
	}
	merged := mergeCandidates(append(cands, *ws))
	if len(merged) != 1 || merged[0].Serial != "2657712810F9A7" || merged[0].LanPort != 9999 {
		t.Fatalf("merge: %+v", merged)
	}
	for _, s := range []string{"SN_XXX", "xxxx", "unknown", "0000"} {
		if cleanSerial(s) != "" {
			t.Fatalf("placeholder kept: %s", s)
		}
	}
}

func TestUnsupportedVendorMdns(t *testing.T) {
	cands, _ := candidatesFromMdnsRecords([]mdnsRecord{{Name: "_ultimaker._tcp.local", Type: typePTR, PTR: "S5._ultimaker._tcp.local"}}, "192.168.1.9")
	ps := finalizeCandidates(mergeCandidates(cands), nil, nil)
	if len(ps) != 1 || ps[0].Vendor != "ultimaker" || ps[0].Supported {
		t.Fatalf("%+v", ps)
	}
}

func TestUdpVendorParsers(t *testing.T) {
	sdcp := `{"Id":"x","Data":{"Name":"Centauri Carbon","MachineName":"Centauri Carbon","BrandName":"ELEGOO","MainboardIP":"192.168.1.66","MainboardID":"ffffffff2a6c0f00"}}`
	c := parseSdcpResponse(sdcp, "192.168.1.1")
	if c == nil || c.Host != "192.168.1.66" || c.Serial != "ffffffff2a6c0f00" || c.LanPort != 3030 {
		t.Fatalf("sdcp: %+v", c)
	}
	legacy := parseSdcpResponse(`{"Data":{"Attributes":{"MainboardID":"abc","Name":"Saturn 3 Ultra"}}}`, "192.168.1.50")
	if legacy == nil || legacy.Serial != "abc" || legacy.Host != "192.168.1.50" {
		t.Fatalf("legacy: %+v", legacy)
	}
	if parseSdcpResponse("M99999", "1.2.3.4") != nil || parseSdcpResponse("{}", "1.2.3.4") != nil {
		t.Fatal("junk sdcp accepted")
	}
	sm := parseSnapmakerResponse("Snapmaker@192.168.1.31|model:Snapmaker 2 Model A350|status:IDLE|SACP:1", "192.168.1.31")
	if sm == nil || sm.Model != "Snapmaker 2 Model A350" {
		t.Fatalf("snapmaker: %+v", sm)
	}
	if parseSnapmakerResponse("discover", "1.1.1.1") != nil {
		t.Fatal("snapmaker junk")
	}
	ff := ParseFlashforgeM115("CMD M115 Received.\r\nMachine Type: Flashforge Adventurer 5M\r\nMachine Name: AD5M\r\nFirmware: v2.7.5\r\nSN: SNMOMC9900728\r\nMac Address: 88:A9:A7:93:86:F8\r\nok\r\n")
	if ff == nil || ff.Serial != "SNMOMC9900728" || ff.MachineType != "Flashforge Adventurer 5M" || normalizeMac(ff.MAC) != "88:a9:a7:93:86:f8" {
		t.Fatalf("m115: %+v", ff)
	}
	blob := append(append(append([]byte("AD5M Atolye"), make([]byte, 20)...), []byte("SNMOMC9900728")...), make([]byte, 8)...)
	fu := parseFlashforgeUdp(blob, "192.168.1.70")
	if fu == nil || fu.Serial != "SNMOMC9900728" || fu.Name != "AD5M Atolye" {
		t.Fatalf("ff udp: %+v", fu)
	}
}

func addr(ip string, bits int) IfaceAddr {
	return IfaceAddr{IP: net.ParseIP(ip).To4(), Mask: net.CIDRMask(bits, 32)}
}

func TestInterfaceEnumeration(t *testing.T) {
	raw := []RawInterface{
		{Name: "lo0", Flags: net.FlagUp | net.FlagLoopback, Addrs: []IfaceAddr{addr("127.0.0.1", 8)}},
		{Name: "en0", Flags: net.FlagUp, Addrs: []IfaceAddr{addr("192.168.1.20", 24)}},
		{Name: "en1", Flags: net.FlagUp, Addrs: []IfaceAddr{addr("10.20.30.40", 16)}},
		{Name: "docker0", Flags: net.FlagUp, Addrs: []IfaceAddr{addr("172.17.0.1", 16)}},
		{Name: "utun3", Flags: net.FlagUp, Addrs: []IfaceAddr{addr("10.8.0.2", 24)}},
		{Name: "en5", Flags: net.FlagUp, Addrs: []IfaceAddr{addr("169.254.10.2", 16)}},
		{Name: "eth9", Flags: net.FlagUp, Addrs: []IfaceAddr{addr("203.0.113.5", 24)}},
		{Name: "en7", Flags: net.FlagUp, Addrs: []IfaceAddr{addr("192.168.1.21", 24)}},
	}
	list := ListScanInterfaces(raw)
	if len(list) != 2 || list[0].CIDR != "192.168.1.0/24" || list[1].CIDR != "10.20.30.0/24" || list[1].Broadcast != "10.20.30.255" {
		t.Fatalf("%+v", list)
	}
	hosts := hostsInCidr("192.168.1.0/24", []string{"192.168.1.20"})
	if len(hosts) != 253 || hosts[0] != "192.168.1.1" || hosts[len(hosts)-1] != "192.168.1.254" {
		t.Fatalf("hosts %d", len(hosts))
	}
	if len(hostsInCidr("10.0.0.0/16", nil)) != 254 {
		t.Fatal("cap /24")
	}
}

func TestArpParse(t *testing.T) {
	if m := parseArpTable("? (192.168.1.151) at 0:e0:4c:68:1:2 on en0 ifscope [ethernet]"); m["192.168.1.151"] != "00:e0:4c:68:01:02" {
		t.Fatalf("mac %v", m)
	}
	if m := parseArpTable("192.168.1.40 0x1 0x2 b8:27:eb:12:34:56 * wlan0"); m["192.168.1.40"] != "b8:27:eb:12:34:56" {
		t.Fatalf("linux %v", m)
	}
	if m := parseArpTable("  192.168.1.66          88-a9-a7-93-86-f8     dynamic"); m["192.168.1.66"] != "88:a9:a7:93:86:f8" {
		t.Fatalf("win %v", m)
	}
	if len(parseArpTable("? (192.168.1.9) at (incomplete) on en0")) != 0 {
		t.Fatal("incomplete parsed")
	}
}

func TestMergeAndFinalize(t *testing.T) {
	m := mergeCandidates([]candidate{
		{Vendor: "bambu", Host: "192.168.1.151", Serial: "01P00A123456789", Model: "P1S", Methods: []string{"ssdp"}, Confidence: 0.95},
		{Vendor: "bambu", Host: "192.168.1.151", Serial: "01P00A123456789", Methods: []string{"tls-probe"}, Confidence: 0.9, Extra: map[string]any{"certSha256": "AA"}},
	})
	if len(m) != 1 || len(m[0].Methods) != 2 || m[0].Model != "P1S" || m[0].Confidence <= 0.95 {
		t.Fatalf("merge: %+v", m)
	}

	m2 := mergeCandidates([]candidate{
		{Vendor: "creality", Host: "192.168.1.80", Methods: []string{"mdns"}, Confidence: 0.5},
		{Vendor: "creality", Host: "192.168.1.80", Serial: "F012345", Methods: []string{"ws-probe"}, Confidence: 0.85},
		{Vendor: "klipper", Host: "192.168.1.80", MAC: "aa:bb:cc:00:11:22", Methods: []string{"http-probe"}, Confidence: 0.9},
	})
	if len(m2) != 2 {
		t.Fatalf("m2: %+v", m2)
	}
	final := finalizeCandidates(m2, nil, nil)
	if final[0].Vendor != "creality" || !strings.Contains(strings.Join(final[1].Notes, " "), "marka sürücüsü") {
		t.Fatalf("final: %+v", final)
	}
	if prim := PrimaryCandidates(final); len(prim) != 1 || prim[0].Vendor != "creality" {
		t.Fatalf("primary: %+v", prim)
	}

	m3 := mergeCandidates([]candidate{
		{Vendor: "klipper", Host: "192.168.1.40", MAC: "B8:27:EB:12:34:56", Methods: []string{"mdns"}, Confidence: 0.7},
		{Vendor: "klipper", Host: "192.168.1.41", MAC: "b8-27-eb-12-34-56", Methods: []string{"scan"}, Confidence: 0.9},
	})
	if len(m3) != 1 {
		t.Fatalf("mac dedupe: %+v", m3)
	}

	ps := finalizeCandidates(
		mergeCandidates([]candidate{{Vendor: "bambu", Host: "192.168.1.151", Serial: "01P00A123456789", Methods: []string{"ssdp"}, Confidence: 0.95}}),
		[]config.PrinterEntry{{Vendor: "bambu", Serial: "01p00a123456789", MachineID: "m-1"}},
		map[string]string{"01P00A123456789": "ZX81QW09"},
	)
	b, _ := json.Marshal(ps[0])
	if !ps[0].Paired || ps[0].MachineID != "m-1" || ps[0].NeedsSecret != SecretBambuAccessCode || !ps[0].SecretAvailable || strings.Contains(string(b), "ZX81QW09") {
		t.Fatalf("finalize: %s", b)
	}
	var generic map[string]any
	_ = json.Unmarshal(b, &generic)
	for _, k := range []string{"id", "vendor", "vendorLabel", "supported", "host", "serial", "mac", "model", "name", "lanPort", "methods", "confidence", "needsSecret", "secretAvailable", "cloudAlternative", "paired", "machineId", "notes"} {
		if _, ok := generic[k]; !ok {
			t.Fatalf("schema key missing: %s", k)
		}
	}
}

func TestPairingSerial(t *testing.T) {
	if PairingSerial(Printer{Vendor: "x", Serial: "S1"}) != "S1" ||
		PairingSerial(Printer{Vendor: "x", MAC: "aa:bb:cc:dd:ee:ff"}) != "AABBCCDDEEFF" ||
		PairingSerial(Printer{Vendor: "octoprint", Host: "1.2.3.4"}) != "octoprint-1.2.3.4" {
		t.Fatal("pairing serial")
	}
}

func TestSlicerConf(t *testing.T) {
	conf := "{\n \"app\": {\"version\": \"1.9\"},\n \"access_code\": {\"01P00A123456789\": \"12345678\", \"bad\": \"x\"},\n \"user_access_code\": {\"00M09A111111111\": \"abcdEF12\"}\n}\n# MD5 checksum 0123456789ABCDEF\n"
	codes := extractAccessCodes(parseSlicerConf(conf))
	if codes["01P00A123456789"] != "12345678" || codes["00M09A111111111"] != "abcdEF12" {
		t.Fatalf("%v", codes)
	}
	if _, ok := codes["bad"]; ok {
		t.Fatal("bad serial kept")
	}
	arr := extractAccessCodes(map[string]any{"devices": []any{map[string]any{"dev_id": "03919A222222222", "access_code": "87654321"}}})
	if arr["03919A222222222"] != "87654321" {
		t.Fatalf("%v", arr)
	}
	if parseSlicerConf("not json") != nil {
		t.Fatal("garbage parsed")
	}
}
