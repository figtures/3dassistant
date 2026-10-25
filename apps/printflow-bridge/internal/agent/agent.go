package agent

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/printflow/printflow-bridge/internal/config"
	"github.com/printflow/printflow-bridge/internal/discovery"
	"github.com/printflow/printflow-bridge/internal/pairing"
	"github.com/printflow/printflow-bridge/internal/poller"
	"github.com/printflow/printflow-bridge/internal/printflow"
)

const (
	rediscoverAfterFailures = 3
	rediscoverCooldown      = 5 * time.Minute
)

type hostChange struct {
	machineID string
	found     discovery.Printer
}

type Agent struct {
	client  *printflow.Client
	cfg     *config.File
	version string

	failures   map[string]int
	lastSearch map[string]time.Time
	searching  map[string]bool
	mu         sync.Mutex
	changes    []hostChange
}

func New(client *printflow.Client, cfg *config.File, version string) *Agent {
	return &Agent{
		client:     client,
		cfg:        cfg,
		version:    version,
		failures:   map[string]int{},
		lastSearch: map[string]time.Time{},
		searching:  map[string]bool{},
	}
}

func (a *Agent) Tick() error {
	dirty := a.applyHostChanges()
	for i := range a.cfg.Printers {
		p := &a.cfg.Printers[i]
		tel, observed, err := poller.Read(*p)
		if p.Vendor == "bambu" && p.BambuCertSHA256 == "" && observed != "" && err == nil {
			p.BambuCertSHA256 = observed
			dirty = true
		}
		if err != nil {
			log.Printf("%s %s: %v", p.Vendor, p.Serial, err)
			msg := err.Error()
			tel = printflow.Telemetry{
				ConnectionStatus: "error",
				PrinterState:     "offline",
				ErrorMessage:     &msg,
				Raw:              map[string]interface{}{"vendor": p.Vendor},
			}
			a.noteFailure(*p)
		} else {
			a.failures[p.MachineID] = 0
		}
		if err := a.client.PushTelemetry(p.MachineID, tel); err != nil {
			return fmt.Errorf("push %s: %w", p.MachineID, err)
		}
	}
	if dirty {
		if err := config.Save(a.cfg); err != nil {
			log.Printf("config kaydedilemedi: %v", err)
		}
	}
	return nil
}

// noteFailure art arda hatalarda (DHCP ile IP değişmiş olabilir) arka planda seri/MAC ile yeniden arar.
func (a *Agent) noteFailure(p config.PrinterEntry) {
	a.failures[p.MachineID]++
	if a.failures[p.MachineID] < rediscoverAfterFailures {
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.searching[p.MachineID] || time.Since(a.lastSearch[p.MachineID]) < rediscoverCooldown {
		return
	}
	a.searching[p.MachineID] = true
	a.lastSearch[p.MachineID] = time.Now()
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
		defer cancel()
		hit := discovery.Rediscover(ctx, p)
		a.mu.Lock()
		defer a.mu.Unlock()
		a.searching[p.MachineID] = false
		if hit == nil {
			log.Printf("%s %s: yeniden keşifte bulunamadı (yazıcı kapalı olabilir)", p.Vendor, p.Serial)
			return
		}
		if hit.Host != p.Host {
			a.changes = append(a.changes, hostChange{machineID: p.MachineID, found: *hit})
		}
	}()
}

func (a *Agent) applyHostChanges() bool {
	a.mu.Lock()
	changes := a.changes
	a.changes = nil
	a.mu.Unlock()
	dirty := false
	for _, c := range changes {
		for i := range a.cfg.Printers {
			p := &a.cfg.Printers[i]
			if p.MachineID != c.machineID {
				continue
			}
			log.Printf("%s %s: IP değişti %s → %s", p.Vendor, p.Serial, p.Host, c.found.Host)
			p.Host = c.found.Host
			if p.MAC == "" {
				p.MAC = c.found.MAC
			}
			if c.found.LanPort > 0 && p.LanPort == 0 && p.Vendor != "bambu" {
				p.LanPort = c.found.LanPort
			}
			a.failures[p.MachineID] = 0
			dirty = true
			if err := a.client.PatchBindingHost(p.MachineID, p.Host); err != nil {
				log.Printf("bağlama güncellenemedi: %v", err)
			}
		}
	}
	return dirty
}

// ParseDeepLink printflow://pair?code=123456&url=https://... → (kod, site kökü).
func ParseDeepLink(raw string) (string, string, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return "", "", err
	}
	if u.Scheme != "printflow" || (u.Host != "pair" && strings.Trim(u.Opaque+u.Path, "/") != "pair") {
		return "", "", fmt.Errorf("desteklenmeyen bağlantı: %s", raw)
	}
	q := u.Query()
	code := strings.TrimSpace(q.Get("code"))
	base := strings.TrimSpace(q.Get("url"))
	if !pairing.ValidCode(code) {
		return "", "", fmt.Errorf("bağlantıdaki eşleştirme kodu 6 haneli olmalı")
	}
	bu, err := url.Parse(base)
	if err != nil || (bu.Scheme != "http" && bu.Scheme != "https") || bu.Host == "" {
		return "", "", fmt.Errorf("bağlantıdaki url http(s) olmalı")
	}
	return code, strings.TrimRight(base, "/"), nil
}

// HandleDeepLink bağlantıdaki kodla keşif + seçim ekranı üzerinden eşleştirir.
func HandleDeepLink(ctx context.Context, raw string, opts pairing.Options) error {
	code, base, err := ParseDeepLink(raw)
	if err != nil {
		return err
	}
	opts.Code = code
	opts.URL = base
	return pairing.Run(ctx, opts)
}
