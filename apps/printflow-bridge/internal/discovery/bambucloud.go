package discovery

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"
)

// Bambu hesabından LAN erişim kodu (dev_access_code) — yalnızca atölye bilgisayarından Bambu'nun kendi
// API'sine. Kod/jeton PrintFlow bulutuna, JSON çıktısına veya loglara yazılmaz.

// BambuAPIBases bölgeye göre Bambu bulut API kökü.
var BambuAPIBases = map[string]string{"global": "https://api.bambulab.com", "cn": "https://api.bambulab.cn"}

var (
	tokenKeyRe  = regexp.MustCompile(`(?i)^(access_?token|token|user_?token|auth_?token)$`)
	tokenCharRe = regexp.MustCompile(`^[A-Za-z0-9._\-+/=]+$`)
)

func tokenLooksValid(s string) bool {
	s = strings.TrimSpace(s)
	return len(s) >= 20 && len(s) <= 4096 && tokenCharRe.MatchString(s)
}

// BambuCloudInfo `discover --json` içindeki durum özeti (sır içermez).
type BambuCloudInfo struct {
	TokenSource   *string `json:"tokenSource"`   // token | slicer | null
	SlicerSession *string `json:"slicerSession"` // present | missing | found | encrypted | null
	CodesFound    int     `json:"codesFound"`
	Error         *string `json:"error"`
}

// CloudOptions Bambu hesabından kod alma ayarları.
type CloudOptions struct {
	Token       string // --bambu-token / BAMBU_CLOUD_TOKEN
	Region      string // global | cn
	SlicerToken string // ask | use | no
	Disabled    bool   // --no-cloud-codes
	HTTPClient  *http.Client
	// Consent etkileşimli onay; nil ise sorulmaz (yalnızca uyarı).
	Consent func(app string) bool
}

func slicerTokenPaths(goos string, getenv func(string) string, home string) []slicerPath {
	var out []slicerPath
	for _, d := range slicerAppDirs(goos, getenv, home) {
		out = append(out, slicerPath{d.App, filepath.Join(d.Dir, "BambuNetworkEngine.conf")})
		out = append(out, slicerPath{d.App, filepath.Join(d.Dir, d.Conf)})
	}
	return out
}

func defaultTokenPaths() []slicerPath {
	home, _ := os.UserHomeDir()
	return slicerTokenPaths(runtime.GOOS, os.Getenv, home)
}

// slicerSessionApp onay istemeden önce yalnızca varlık kontrolü (dosya okunmaz).
func slicerSessionApp(paths []slicerPath) string {
	for _, p := range paths {
		if strings.HasSuffix(p.Path, "BambuNetworkEngine.conf") {
			if _, err := os.Stat(p.Path); err == nil {
				return p.App
			}
		}
	}
	return ""
}

// findTokenInDoc JSON belgesinde bulut oturum jetonu (anahtar adı token/access_token…).
func findTokenInDoc(doc any) string {
	var visit func(node any, depth int) string
	visit = func(node any, depth int) string {
		if depth > 6 {
			return ""
		}
		switch n := node.(type) {
		case map[string]any:
			for k, v := range n {
				if s, ok := v.(string); ok && tokenKeyRe.MatchString(k) && tokenLooksValid(s) {
					return strings.TrimSpace(s)
				}
			}
			for _, v := range n {
				if t := visit(v, depth+1); t != "" {
					return t
				}
			}
		case []any:
			for _, v := range n {
				if t := visit(v, depth+1); t != "" {
					return t
				}
			}
		}
		return ""
	}
	return visit(doc, 0)
}

// readSlicerCloudToken dilimleyicinin yerel Bambu oturumu: found | encrypted | missing.
func readSlicerCloudToken(paths []slicerPath) (status, app, token string) {
	status = "missing"
	for _, p := range paths {
		b, err := os.ReadFile(p.Path)
		if err != nil {
			continue
		}
		doc := parseSlicerConf(string(b))
		if doc != nil {
			if t := findTokenInDoc(doc); t != "" {
				return "found", p.App, t
			}
		} else if strings.HasSuffix(p.Path, "BambuNetworkEngine.conf") {
			status, app = "encrypted", p.App
		}
	}
	return status, app, ""
}

// AccessCodesFromBind `GET /v1/iot-service/api/user/bind` yanıtı → seri → erişim kodu.
func AccessCodesFromBind(body []byte) map[string]string {
	var doc struct {
		Devices []struct {
			DevID         string `json:"dev_id"`
			DevAccessCode string `json:"dev_access_code"`
		} `json:"devices"`
	}
	out := map[string]string{}
	if json.Unmarshal(body, &doc) != nil {
		return out
	}
	for _, d := range doc.Devices {
		serial, code := strings.TrimSpace(d.DevID), strings.TrimSpace(d.DevAccessCode)
		if slicerSerialR.MatchString(serial) && codeRe.MatchString(code) {
			out[serial] = code
		}
	}
	return out
}

// FetchBambuAccessCodes Bambu hesabına bağlı yazıcıların erişim kodları (yerelden Bambu API'sine).
func FetchBambuAccessCodes(ctx context.Context, token, region string, client *http.Client) (map[string]string, error) {
	base := BambuAPIBases[region]
	if base == "" {
		base = BambuAPIBases["global"]
	}
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+"/v1/iot-service/api/user/bind", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "PrintFlow-Bridge")
	res, err := client.Do(req)
	if err != nil {
		var ue interface{ Timeout() bool }
		if errors.As(err, &ue) && ue.Timeout() {
			return nil, errors.New("Bambu bulutuna ulaşılamadı (zaman aşımı)")
		}
		return nil, errors.New("Bambu bulutuna ulaşılamadı")
	}
	defer res.Body.Close()
	if res.StatusCode == 401 || res.StatusCode == 403 {
		return nil, errors.New("Bambu oturumu geçersiz veya süresi dolmuş")
	}
	if res.StatusCode/100 != 2 {
		return nil, fmt.Errorf("Bambu bulut hatası (HTTP %d)", res.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if err != nil {
		return nil, err
	}
	return AccessCodesFromBind(body), nil
}

// ApplyBambuCloud eksik Bambu erişim kodlarını Bambu hesabından (yerelde) alır, sonuçları işaretler ve
// kodları döndürür. Jeton yoksa dilimleyici oturumu yalnızca onayla (Consent / SlicerToken=use) okunur.
func ApplyBambuCloud(ctx context.Context, res *Result, o CloudOptions) map[string]string {
	return applyBambuCloud(ctx, res, o, defaultTokenPaths())
}

func applyBambuCloud(ctx context.Context, res *Result, o CloudOptions, paths []slicerPath) map[string]string {
	codes := map[string]string{}
	res.BambuCloud = BambuCloudInfo{}
	var missing []Printer
	for _, p := range res.Printers {
		if p.Vendor == "bambu" && p.Serial != "" && !p.SecretAvailable && !p.Paired {
			missing = append(missing, p)
		}
	}
	if len(missing) == 0 || o.Disabled {
		return codes
	}
	strp := func(s string) *string { return &s }
	token := o.Token
	if token != "" {
		res.BambuCloud.TokenSource = strp("token")
	} else if o.SlicerToken != "no" {
		app := slicerSessionApp(paths)
		if app == "" {
			res.BambuCloud.SlicerSession = strp("missing")
		} else {
			res.BambuCloud.SlicerSession = strp("present")
			use := o.SlicerToken == "use"
			if !use && o.Consent != nil {
				use = o.Consent(app)
			} else if !use {
				res.Warnings = append(res.Warnings, app+" Bambu oturumu bulundu; --use-slicer-token ile erişim kodu otomatik alınabilir.")
			}
			if use {
				status, _, t := readSlicerCloudToken(paths)
				res.BambuCloud.SlicerSession = strp(status)
				if t != "" {
					token = t
					res.BambuCloud.TokenSource = strp("slicer")
				} else if status == "encrypted" {
					res.Warnings = append(res.Warnings, app+" oturumu şifreli saklanıyor; jeton okunamadı (--bambu-token verin veya kodu girin).")
				}
			}
		}
	}
	if token == "" {
		return codes
	}
	got, err := FetchBambuAccessCodes(ctx, token, o.Region, o.HTTPClient)
	if err != nil {
		res.BambuCloud.Error = strp(err.Error())
		res.Warnings = append(res.Warnings, "Bambu hesabından erişim kodu alınamadı: "+err.Error())
		return codes
	}
	codes = got
	MarkAccessCodes(res.Printers, codes, "Bambu hesabı")
	for _, p := range missing {
		if codes[p.Serial] != "" {
			res.BambuCloud.CodesFound++
		}
	}
	if res.BambuCloud.CodesFound == 0 {
		res.Warnings = append(res.Warnings, "Bambu hesabında bu ağdaki yazıcıların erişim kodu bulunamadı (yazıcı başka hesaba bağlı olabilir).")
	}
	return codes
}
