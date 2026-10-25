package discovery

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
)

var (
	codeRe        = regexp.MustCompile(`^[0-9A-Za-z]{6,16}$`)
	accessKeyRe   = regexp.MustCompile(`(?i)access_code`)
	slicerSerialR = regexp.MustCompile(`^[0-9A-Z]{8,20}$`)
)

type slicerPath struct {
	App  string
	Path string
}

type slicerAppDir struct {
	App, Dir, Conf string
}

// slicerAppDirs Bambu Studio / OrcaSlicer veri klasörleri (platforma göre; Linux'ta Flatpak dahil).
func slicerAppDirs(goos string, getenv func(string) string, home string) []slicerAppDir {
	apps := [][3]string{
		{"BambuStudio", "BambuStudio.conf", "com.bambulab.BambuStudio"},
		{"OrcaSlicer", "OrcaSlicer.conf", "io.github.softfever.OrcaSlicer"},
	}
	base := slicerBaseDir(goos, getenv, home)
	var out []slicerAppDir
	for _, a := range apps {
		out = append(out, slicerAppDir{a[0], filepath.Join(base, a[0]), a[1]})
	}
	if goos != "darwin" && goos != "windows" {
		for _, a := range apps {
			out = append(out, slicerAppDir{a[0], filepath.Join(home, ".var", "app", a[2], "config", a[0]), a[1]})
		}
	}
	return out
}

// slicerConfigPaths Bambu Studio / OrcaSlicer yapılandırma dosyası adayları (platforma göre).
func slicerConfigPaths(goos string, getenv func(string) string, home string) []slicerPath {
	var out []slicerPath
	for _, d := range slicerAppDirs(goos, getenv, home) {
		out = append(out, slicerPath{d.App, filepath.Join(d.Dir, d.Conf)})
	}
	return out
}

func slicerBaseDir(goos string, getenv func(string) string, home string) string {
	var base string
	switch goos {
	case "darwin":
		base = filepath.Join(home, "Library", "Application Support")
	case "windows":
		base = getenv("APPDATA")
		if base == "" {
			base = filepath.Join(home, "AppData", "Roaming")
		}
	default:
		base = getenv("XDG_CONFIG_HOME")
		if base == "" {
			base = filepath.Join(home, ".config")
		}
	}
	return base
}

// parseSlicerConf `.conf` JSON + sonda `# MD5 checksum …` satırı olabilir; yorum satırlarını atarak parse.
func parseSlicerConf(text string) any {
	var keep []string
	for _, l := range strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n") {
		if !strings.HasPrefix(strings.TrimSpace(l), "#") {
			keep = append(keep, l)
		}
	}
	var doc any
	if err := json.Unmarshal([]byte(strings.Join(keep, "\n")), &doc); err != nil {
		return nil
	}
	return doc
}

// extractAccessCodes yapılandırmadan seri → erişim kodu. Biçim sürümler arasında değişebildiği için
// anahtar adında "access_code" geçen nesneleri ve {dev_id, access_code} dizilerini arar.
func extractAccessCodes(doc any) map[string]string {
	out := map[string]string{}
	var visit func(node any, depth int)
	visit = func(node any, depth int) {
		if node == nil || depth > 8 {
			return
		}
		switch n := node.(type) {
		case []any:
			for _, x := range n {
				visit(x, depth+1)
			}
		case map[string]any:
			devID, _ := firstNonNil(n, "dev_id", "dev_sn", "serial").(string)
			code, _ := firstNonNil(n, "access_code", "dev_access_code").(string)
			if slicerSerialR.MatchString(devID) && codeRe.MatchString(code) {
				out[devID] = code
			}
			for k, v := range n {
				if obj, ok := v.(map[string]any); ok && accessKeyRe.MatchString(k) {
					for serial, c := range obj {
						if cs, ok := c.(string); ok && slicerSerialR.MatchString(serial) && codeRe.MatchString(cs) {
							out[serial] = cs
						}
					}
					continue
				}
				switch v.(type) {
				case map[string]any, []any:
					visit(v, depth+1)
				}
			}
		}
	}
	visit(doc, 0)
	return out
}

func readSlicerAccessCodesFrom(paths []slicerPath) (map[string]string, []string) {
	codes := map[string]string{}
	sources := []string{}
	for _, p := range paths {
		b, err := os.ReadFile(p.Path)
		if err != nil {
			continue
		}
		doc := parseSlicerConf(string(b))
		if doc == nil {
			continue
		}
		found := extractAccessCodes(doc)
		for serial, code := range found {
			if _, ok := codes[serial]; !ok {
				codes[serial] = code
			}
		}
		if len(found) > 0 && !containsStr(sources, p.App) {
			sources = append(sources, p.App)
		}
	}
	return codes, sources
}

func containsStr(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}

// ReadSlicerAccessCodes yerel dilimleyici ayarlarından erişim kodları (yalnızca okuma; hiçbir yere
// gönderilmez). Dönen ikinci değer kodların bulunduğu uygulamalar.
func ReadSlicerAccessCodes() (map[string]string, []string) {
	home, _ := os.UserHomeDir()
	return readSlicerAccessCodesFrom(slicerConfigPaths(runtime.GOOS, os.Getenv, home))
}
