package discovery

import (
	"encoding/json"
	"math"
	"regexp"
	"sort"
	"strings"

	"github.com/printflow/printflow-bridge/internal/config"
)

// DriverVendors köprü sürücüsü olan markalar (src/lib/bridge/vendors.ts ile aynı liste).
var DriverVendors = []string{
	"bambu",
	"creality",
	"anycubic",
	"elegoo",
	"flashforge",
	"snapmaker",
	"klipper",
	"octoprint",
	"prusalink",
}

// VendorLabels okunur marka adları.
var VendorLabels = map[string]string{
	"bambu":      "Bambu Lab",
	"creality":   "Creality",
	"anycubic":   "Anycubic",
	"elegoo":     "Elegoo",
	"flashforge": "Flashforge",
	"snapmaker":  "Snapmaker",
	"klipper":    "Klipper (Moonraker)",
	"octoprint":  "OctoPrint",
	"prusalink":  "Prusa (PrusaLink)",
	"ultimaker":  "UltiMaker",
	"formlabs":   "Formlabs",
}

// Eşleştirmede yerel olarak sorulacak sır (buluta gönderilmez).
const (
	SecretBambuAccessCode = "bambu_access_code"
	SecretPrusaLinkPass   = "prusalink_password"
	SecretOctoPrintAPIKey = "octoprint_api_key"
	SecretMoonrakerAPIKey = "moonraker_api_key"
)

var vendorSecret = map[string]string{
	"bambu":     SecretBambuAccessCode,
	"prusalink": SecretPrusaLinkPass,
	"octoprint": SecretOctoPrintAPIKey,
}

const (
	bambuNoteSlicer    = "Erişim kodu Bambu Studio/OrcaSlicer ayarlarında bulundu."
	bambuNoteNeedsCode = "Erişim kodu gerekli (8 karakter): yazıcı ekranı → Ayarlar → Ağ/WLAN → LAN Only / Access Code."
	bambuNoteCloudAlt  = "Kod girmeden: PrintFlow panelinde Makineler → Yazıcıları bağla ile Bambu hesabını bağlayın (bulut telemetri, köprü gerekmez) veya köprüde --bambu-token / --use-slicer-token ile kodu Bambu hesabından yerelde alın."
	bambuNoteCloudMode = "Yazıcı bulut modunda: yerel MQTT erişim koduyla okunabilir; bağlantı reddedilirse LAN Only (yeni firmware'de Developer Mode) açın."
)

// MarkAccessCodes Bambu yazıcılarda yerel olarak elde edilen kodları işaretler (kodlar şemaya yazılmaz).
func MarkAccessCodes(printers []Printer, codes map[string]string, sourceLabel string) {
	for i := range printers {
		p := &printers[i]
		if p.Vendor != "bambu" || p.SecretAvailable || p.Serial == "" || codes[p.Serial] == "" {
			continue
		}
		p.SecretAvailable = true
		notes := []string{"Erişim kodu " + sourceLabel + " üzerinden alındı (yalnızca bu bilgisayarda saklanır)."}
		for _, n := range p.Notes {
			if n != bambuNoteNeedsCode && n != bambuNoteCloudAlt {
				notes = append(notes, n)
			}
		}
		p.Notes = notes
	}
}

// Genel yazılım katmanları — aynı IP'de marka sürücüsü varsa ikincil sıralanır.
func isGenericVendor(v string) bool { return v == "klipper" || v == "octoprint" }

// IsDriverVendor markanın köprü sürücüsü var mı.
func IsDriverVendor(v string) bool {
	for _, d := range DriverVendors {
		if d == v {
			return true
		}
	}
	return false
}

// candidate yöntemlerin ürettiği ham keşif adayı ("" = bilinmiyor).
type candidate struct {
	Vendor       string
	Host         string
	Serial       string
	MAC          string
	Model        string
	Name         string
	LanPort      int
	Methods      []string
	Confidence   float64
	AuthRequired bool
	Extra        map[string]any
}

// Printer keşif sonucu (genel JSON şeması; sırlar asla dahil edilmez).
type Printer struct {
	ID              string
	Vendor          string
	VendorLabel     string
	Supported       bool
	Host            string
	Serial          string
	MAC             string
	Model           string
	Name            string
	LanPort         int
	Methods         []string
	Confidence      float64
	NeedsSecret      string
	SecretAvailable  bool
	CloudAlternative bool
	Paired           bool
	MachineID        string
	Notes            []string

	// Yalnızca yerel kullanım (JSON'a yazılmaz).
	CertSHA256 string
}

func nullStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// MarshalJSON boş alanları null olarak yazar (Node şemasıyla birebir).
func (p Printer) MarshalJSON() ([]byte, error) {
	var lanPort *int
	if p.LanPort > 0 {
		lp := p.LanPort
		lanPort = &lp
	}
	methods := p.Methods
	if methods == nil {
		methods = []string{}
	}
	notes := p.Notes
	if notes == nil {
		notes = []string{}
	}
	return json.Marshal(struct {
		ID              string   `json:"id"`
		Vendor          string   `json:"vendor"`
		VendorLabel     string   `json:"vendorLabel"`
		Supported       bool     `json:"supported"`
		Host            string   `json:"host"`
		Serial          *string  `json:"serial"`
		MAC             *string  `json:"mac"`
		Model           *string  `json:"model"`
		Name            *string  `json:"name"`
		LanPort         *int     `json:"lanPort"`
		Methods         []string `json:"methods"`
		Confidence      float64  `json:"confidence"`
		NeedsSecret      *string  `json:"needsSecret"`
		SecretAvailable  bool     `json:"secretAvailable"`
		CloudAlternative bool     `json:"cloudAlternative"`
		Paired           bool     `json:"paired"`
		MachineID        *string  `json:"machineId"`
		Notes            []string `json:"notes"`
	}{
		p.ID, p.Vendor, p.VendorLabel, p.Supported, p.Host,
		nullStr(p.Serial), nullStr(p.MAC), nullStr(p.Model), nullStr(p.Name), lanPort,
		methods, p.Confidence, nullStr(p.NeedsSecret), p.SecretAvailable, p.CloudAlternative, p.Paired,
		nullStr(p.MachineID), notes,
	})
}

// Yer tutucu seriler (ör. Creality WS'de "SN_XXX") kimlik sayılmaz.
var badSerial = regexp.MustCompile(`(?i)^(unknown|null|none|undefined|0+|x+|(sn)?[_-]?x{2,})$`)

func cleanSerial(s string) string {
	v := strings.TrimSpace(s)
	if v == "" || badSerial.MatchString(v) {
		return ""
	}
	return v
}

func keyOf(c candidate) string {
	if s := cleanSerial(c.Serial); s != "" {
		return c.Vendor + "|s|" + strings.ToLower(s)
	}
	if m := normalizeMac(c.MAC); m != "" {
		return c.Vendor + "|m|" + m
	}
	return c.Vendor + "|h|" + c.Host
}

func pick(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

func mergeTwo(a, b candidate) candidate {
	seen := map[string]bool{}
	var methods []string
	for _, m := range append(append([]string{}, a.Methods...), b.Methods...) {
		if !seen[m] {
			seen[m] = true
			methods = append(methods, m)
		}
	}
	extra := map[string]any{}
	for k, v := range b.Extra {
		extra[k] = v
	}
	for k, v := range a.Extra {
		extra[k] = v
	}
	lanPort := a.LanPort
	if lanPort == 0 {
		lanPort = b.LanPort
	}
	out := a
	out.Host = pick(a.Host, b.Host)
	out.Serial = pick(cleanSerial(a.Serial), cleanSerial(b.Serial))
	out.MAC = pick(normalizeMac(a.MAC), normalizeMac(b.MAC))
	out.Model = pick(a.Model, b.Model)
	out.Name = pick(a.Name, b.Name)
	out.LanPort = lanPort
	out.AuthRequired = a.AuthRequired || b.AuthRequired
	out.Methods = methods
	out.Confidence = math.Min(0.99, math.Max(a.Confidence, b.Confidence)+0.05*float64(len(methods)-1))
	out.Extra = extra
	return out
}

func cloneCandidate(c candidate) candidate {
	c.Methods = append([]string(nil), c.Methods...)
	extra := make(map[string]any, len(c.Extra))
	for k, v := range c.Extra {
		extra[k] = v
	}
	c.Extra = extra
	return c
}

// mergeCandidates aynı yazıcı birden çok yöntemle bulunabilir (SSDP + TLS probu, mDNS + HTTP probu…).
// Önce marka+seri, sonra marka+MAC, sonra marka+IP ile birleştirir; serisiz bir kayıt aynı
// marka+IP'deki serili kayda katılır.
func mergeCandidates(list []candidate) []candidate {
	var keys []string
	byKey := map[string]candidate{}
	for _, c := range list {
		if c.Vendor == "" || c.Host == "" {
			continue
		}
		k := keyOf(c)
		if prev, ok := byKey[k]; ok {
			byKey[k] = mergeTwo(prev, c)
		} else {
			keys = append(keys, k)
			byKey[k] = cloneCandidate(c)
		}
	}
	var strong, weak []candidate
	for _, k := range keys {
		c := byKey[k]
		if cleanSerial(c.Serial) != "" || normalizeMac(c.MAC) != "" {
			strong = append(strong, c)
		} else {
			weak = append(weak, c)
		}
	}
	out := strong
	for _, w := range weak {
		idx := -1
		for i, s := range out {
			if s.Vendor == w.Vendor && s.Host == w.Host {
				idx = i
				break
			}
		}
		if idx >= 0 {
			out[idx] = mergeTwo(out[idx], w)
		} else {
			out = append(out, w)
		}
	}
	// Aynı MAC farklı IP (ör. Wi-Fi + Ethernet aynı yazıcı) — aynı marka için tek kayıt.
	var merged []candidate
	for _, c := range out {
		mac := normalizeMac(c.MAC)
		idx := -1
		if mac != "" {
			for i, m := range merged {
				if m.Vendor == c.Vendor && normalizeMac(m.MAC) == mac {
					idx = i
					break
				}
			}
		}
		if idx >= 0 {
			merged[idx] = mergeTwo(merged[idx], c)
		} else {
			merged = append(merged, c)
		}
	}
	return merged
}

func samePrinter(p config.PrinterEntry, vendor, serial, mac, pairing string) bool {
	if !strings.EqualFold(p.Vendor, vendor) {
		return false
	}
	if p.Serial != "" && serial != "" && strings.EqualFold(p.Serial, serial) {
		return true
	}
	if pm := normalizeMac(p.MAC); pm != "" && pm == mac {
		return true
	}
	// Seri/MAC yoksa eşleştirmede kullanılan kararlı kimlik (ör. "octoprint-192.168.1.5").
	return serial == "" && p.Serial != "" && strings.EqualFold(p.Serial, pairing)
}

// finalizeCandidates bulunan adaylar → genel şema (sırlar asla dahil edilmez).
func finalizeCandidates(merged []candidate, paired []config.PrinterEntry, slicerCodes map[string]string) []Printer {
	printers := make([]Printer, 0, len(merged))
	for _, c := range merged {
		serial := cleanSerial(c.Serial)
		mac := normalizeMac(c.MAC)
		supported := IsDriverVendor(c.Vendor)
		pairing := PairingSerial(Printer{Vendor: c.Vendor, Host: c.Host, Serial: serial, MAC: mac})
		var pairedEntry *config.PrinterEntry
		for i := range paired {
			if samePrinter(paired[i], c.Vendor, serial, mac, pairing) {
				pairedEntry = &paired[i]
				break
			}
		}
		needsSecret := vendorSecret[c.Vendor]
		if c.Vendor == "klipper" && c.AuthRequired {
			needsSecret = SecretMoonrakerAPIKey
		}
		_, hasCode := slicerCodes[serial]
		hasCode = hasCode && serial != ""
		notes := []string{}
		if !supported {
			notes = append(notes, "Bu cihaz bulundu ama köprü sürücüsü henüz yok; telemetri okunamaz.")
		}
		connectMode, _ := c.Extra["connectMode"].(string)
		cloudAlternative := c.Vendor == "bambu" && connectMode != "lan"
		if c.Vendor == "bambu" {
			if hasCode {
				notes = append(notes, bambuNoteSlicer)
			} else {
				notes = append(notes, bambuNoteNeedsCode)
				if cloudAlternative {
					notes = append(notes, bambuNoteCloudAlt)
				}
			}
			if connectMode == "cloud" {
				notes = append(notes, bambuNoteCloudMode)
			}
		}
		if c.Vendor == "prusalink" {
			notes = append(notes, "PrusaLink şifresi gerekli: yazıcı ekranı → Ayarlar → Ağ → PrusaLink.")
		}
		if c.Vendor == "octoprint" {
			notes = append(notes, "OctoPrint arayüzünde erişim isteğini onaylamanız istenecek.")
		}
		if needsSecret == SecretMoonrakerAPIKey {
			notes = append(notes, "Moonraker yetki istiyor: API anahtarı girin veya moonraker.conf trusted_clients'a bu bilgisayarı ekleyin.")
		}
		if serial == "" && mac == "" && supported {
			notes = append(notes, "Seri/MAC okunamadı; eşleştirmede IP tabanlı kimlik kullanılacak.")
		}
		id := c.Vendor + ":" + pick(serial, pick(mac, c.Host))
		label := VendorLabels[c.Vendor]
		if label == "" {
			label = c.Vendor
		}
		methods := c.Methods
		if methods == nil {
			methods = []string{}
		}
		p := Printer{
			ID:              id,
			Vendor:          c.Vendor,
			VendorLabel:     label,
			Supported:       supported,
			Host:            c.Host,
			Serial:          serial,
			MAC:             mac,
			Model:           c.Model,
			Name:            c.Name,
			LanPort:         c.LanPort,
			Methods:         methods,
			Confidence:      math.Round(c.Confidence*100) / 100,
			NeedsSecret:     needsSecret,
			SecretAvailable:  c.Vendor == "bambu" && hasCode,
			CloudAlternative: cloudAlternative,
			Paired:           pairedEntry != nil,
			Notes:            notes,
		}
		if pairedEntry != nil {
			p.MachineID = pairedEntry.MachineID
		}
		if sha, ok := c.Extra["certSha256"].(string); ok {
			p.CertSHA256 = sha
		}
		printers = append(printers, p)
	}
	hostHasNative := map[string]bool{}
	for _, p := range printers {
		if !isGenericVendor(p.Vendor) {
			hostHasNative[p.Host] = true
		}
	}
	for i := range printers {
		if isGenericVendor(printers[i].Vendor) && hostHasNative[printers[i].Host] {
			printers[i].Notes = append(printers[i].Notes, "Aynı IP'de marka sürücüsü de bulundu; genelde marka seçeneğini tercih edin.")
		}
	}
	SortPrinters(printers)
	return printers
}

// SortPrinters desteklenen → eşleşmemiş → marka sürücüsü → güven → IP (sayısal) sırası.
func SortPrinters(printers []Printer) {
	sort.SliceStable(printers, func(i, j int) bool {
		a, b := printers[i], printers[j]
		if a.Supported != b.Supported {
			return a.Supported
		}
		if a.Paired != b.Paired {
			return !a.Paired
		}
		if ga, gb := isGenericVendor(a.Vendor), isGenericVendor(b.Vendor); ga != gb {
			return !ga
		}
		if a.Confidence != b.Confidence {
			return a.Confidence > b.Confidence
		}
		return naturalLess(a.Host, b.Host)
	})
}

// naturalLess sayısal parçaları sayı olarak karşılaştırır (192.168.1.9 < 192.168.1.10).
func naturalLess(a, b string) bool {
	for a != "" && b != "" {
		ca, ra := chunk(a)
		cb, rb := chunk(b)
		if ca != cb {
			da, db := isDigit(ca[0]), isDigit(cb[0])
			if da && db {
				na, nb := strings.TrimLeft(ca, "0"), strings.TrimLeft(cb, "0")
				if len(na) != len(nb) {
					return len(na) < len(nb)
				}
				if na != nb {
					return na < nb
				}
			} else {
				return ca < cb
			}
		}
		a, b = ra, rb
	}
	return len(a) < len(b)
}

func isDigit(c byte) bool { return c >= '0' && c <= '9' }

func chunk(s string) (string, string) {
	d := isDigit(s[0])
	i := 1
	for i < len(s) && isDigit(s[i]) == d {
		i++
	}
	return s[:i], s[i:]
}

// PrimaryCandidates otomatik / "tümü" seçimi için: aynı IP'de marka sürücüsü varsa Klipper/OctoPrint
// kaydı aynı fiziksel yazıcının ikinci yüzüdür — elenir (kullanıcı listeden yine elle seçebilir).
func PrimaryCandidates(printers []Printer) []Printer {
	native := map[string]bool{}
	for _, p := range printers {
		if p.Supported && !isGenericVendor(p.Vendor) {
			native[p.Host] = true
		}
	}
	out := make([]Printer, 0, len(printers))
	for _, p := range printers {
		if isGenericVendor(p.Vendor) && native[p.Host] {
			continue
		}
		out = append(out, p)
	}
	return out
}

// PairingSerial eşleştirme API'si seri ister; seri/MAC yoksa marka+IP tabanlı kararlı kimlik.
func PairingSerial(p Printer) string {
	if p.Serial != "" {
		return p.Serial
	}
	if p.MAC != "" {
		return strings.ToUpper(strings.ReplaceAll(p.MAC, ":", ""))
	}
	return p.Vendor + "-" + p.Host
}
