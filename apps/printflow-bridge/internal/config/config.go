package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

type PrinterEntry struct {
	MachineID string `json:"machineId"`
	Vendor    string `json:"vendor"`
	Serial    string `json:"serial"`
	Host      string `json:"host"`
	Label     string `json:"label,omitempty"`
	// Keşif kimliği (IP değişince yeniden bulmak için)
	MAC   string `json:"mac,omitempty"`
	Model string `json:"model,omitempty"`
	// Bambu LAN
	AccessCode       string `json:"accessCode,omitempty"`
	BambuTLSName     string `json:"bambuTlsServerName,omitempty"`
	BambuTLSInsecure bool   `json:"bambuTlsInsecure,omitempty"`
	// İlk bağlantıda kaydedilen sertifika parmak izi (TOFU, "AA:BB:…")
	BambuCertSHA256 string `json:"bambuCertSha256,omitempty"`
	// OctoPrint / Moonraker API anahtarı, PrusaLink şifresi — yalnızca yerelde saklanır
	APIKey   string `json:"apiKey,omitempty"`
	Password string `json:"password,omitempty"`
	// Yerel API portu (markaya özel; 0 = varsayılan)
	LanPort      int `json:"lanPort,omitempty"`
	CrealityPort int `json:"crealityPort,omitempty"`
}

func (p PrinterEntry) EffectiveLanPort() int {
	if p.LanPort > 0 {
		return p.LanPort
	}
	return p.CrealityPort
}

type File struct {
	PrintflowURL string         `json:"printflowUrl"`
	BridgeToken  string         `json:"bridgeToken"`
	Printers     []PrinterEntry `json:"printers"`
}

func DefaultConfigPath() string {
	switch runtime.GOOS {
	case "windows":
		base := os.Getenv("ProgramData")
		if base == "" {
			base = "C:\\ProgramData"
		}
		return filepath.Join(base, "PrintFlow Bridge", "config.json")
	case "darwin":
		home, _ := os.UserHomeDir()
		return filepath.Join(home, "Library", "Application Support", "PrintFlow Bridge", "config.json")
	default:
		home, _ := os.UserHomeDir()
		return filepath.Join(home, ".config", "printflow-bridge", "config.json")
	}
}

func Load() (*File, error) {
	path := DefaultConfigPath()
	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var f File
	if err := json.Unmarshal(b, &f); err != nil {
		return nil, err
	}
	return &f, nil
}

func Save(f *File) error {
	path := DefaultConfigPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	b, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(path, append(b, '\n'), 0o600); err != nil {
		return err
	}
	return os.Chmod(path, 0o600)
}

func (f *File) UpsertPrinter(p PrinterEntry) {
	for i, existing := range f.Printers {
		sameVendor := strings.EqualFold(existing.Vendor, p.Vendor)
		if existing.MachineID == p.MachineID ||
			(sameVendor && existing.Serial == p.Serial) ||
			(sameVendor && p.MAC != "" && strings.EqualFold(existing.MAC, p.MAC)) {
			f.Printers[i] = p
			return
		}
	}
	f.Printers = append(f.Printers, p)
}
