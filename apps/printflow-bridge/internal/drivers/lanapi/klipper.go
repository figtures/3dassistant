package lanapi

import (
	"fmt"
	"strings"

	"github.com/printflow/printflow-bridge/internal/printflow"
)

// PollKlipper Moonraker /printer/objects/query (isteğe bağlı X-Api-Key).
func PollKlipper(host string, port int, apiKey, serial string) (printflow.Telemetry, error) {
	h := map[string]string{}
	if apiKey != "" {
		h["X-Api-Key"] = apiKey
	}
	res, err := do("GET", host, portOr(port, 7125),
		"/printer/objects/query?print_stats&virtual_sdcard&display_status&extruder&heater_bed", h, nil)
	if err != nil {
		return printflow.Telemetry{}, fmt.Errorf("Moonraker: %w", err)
	}
	if res.Status == 401 || res.Status == 403 {
		return printflow.Telemetry{}, fmt.Errorf("Moonraker yetki istiyor: API anahtarı girin veya trusted_clients ayarına bu bilgisayarı ekleyin")
	}
	var doc struct {
		Result struct {
			Status map[string]any `json:"status"`
		} `json:"result"`
	}
	if res.Status >= 300 || res.json(&doc) != nil || doc.Result.Status == nil {
		return printflow.Telemetry{}, fmt.Errorf("Moonraker HTTP %d", res.Status)
	}
	return KlipperTelemetry(serial, doc.Result.Status), nil
}

// KlipperTelemetry Moonraker durum nesneleri → telemetri.
func KlipperTelemetry(serial string, s map[string]any) printflow.Telemetry {
	ps := obj(s, "print_stats")
	state := "idle"
	switch strings.ToLower(str(ps["state"])) {
	case "printing":
		state = "printing"
	case "paused":
		state = "paused"
	case "error":
		state = "error"
	}
	frac := num(obj(s, "display_status")["progress"])
	if frac == nil {
		frac = num(obj(s, "virtual_sdcard")["progress"])
	}
	var pct *float64
	if frac != nil {
		v := *frac * 100
		pct = &v
	}
	return build("klipper", serial, telemetryIn{
		state:     state,
		job:       str(ps["filename"]),
		progress:  pct,
		printTime: num(ps["print_duration"]),
		bed:       num(obj(s, "heater_bed")["temperature"]),
		nozzle:    num(obj(s, "extruder")["temperature"]),
		errMsg:    str(ps["message"]),
		raw:       s,
	})
}
