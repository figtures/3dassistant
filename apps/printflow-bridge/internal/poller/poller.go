// Package poller yapılandırmadaki bir yazıcıyı markasına uygun sürücüyle okur.
package poller

import (
	"strings"

	"github.com/printflow/printflow-bridge/internal/config"
	"github.com/printflow/printflow-bridge/internal/drivers/bambu"
	"github.com/printflow/printflow-bridge/internal/drivers/lanapi"
	"github.com/printflow/printflow-bridge/internal/drivers/vendorlan"
	"github.com/printflow/printflow-bridge/internal/printflow"
)

// Read telemetri okur. Bambu için gözlenen TLS parmak izini de döner (ilk bağlantıda kaydedilir).
func Read(p config.PrinterEntry) (printflow.Telemetry, string, error) {
	switch strings.ToLower(p.Vendor) {
	case "bambu":
		return bambu.Snapshot(bambu.Config{
			Host:          p.Host,
			Serial:        p.Serial,
			AccessCode:    p.AccessCode,
			TLSServerName: p.BambuTLSName,
			TLSInsecure:   p.BambuTLSInsecure,
			CertSHA256:    p.BambuCertSHA256,
		})
	case "klipper":
		t, err := lanapi.PollKlipper(p.Host, p.LanPort, p.APIKey, p.Serial)
		return t, "", err
	case "octoprint":
		t, err := lanapi.PollOctoPrint(p.Host, p.LanPort, p.APIKey, p.Serial)
		return t, "", err
	case "prusalink":
		t, err := lanapi.PollPrusaLink(p.Host, p.LanPort, p.Password, p.Serial)
		return t, "", err
	case "elegoo":
		if t, err := lanapi.PollElegooSDCP(p.Host, p.Serial); err == nil {
			return t, "", nil
		}
		t, err := vendorlan.Poll(p.Vendor, p.Host, p.EffectiveLanPort(), p.Serial, p.Label)
		return t, "", err
	case "flashforge":
		t, err := vendorlan.Poll(p.Vendor, p.Host, p.EffectiveLanPort(), p.Serial, p.Label)
		if err != nil {
			if tt, err2 := lanapi.PollFlashforgeTCP(p.Host, p.Serial); err2 == nil {
				return tt, "", nil
			}
		}
		return t, "", err
	default:
		t, err := vendorlan.Poll(p.Vendor, p.Host, p.EffectiveLanPort(), p.Serial, p.Label)
		return t, "", err
	}
}
