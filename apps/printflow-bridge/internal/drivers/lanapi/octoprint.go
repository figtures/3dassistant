package lanapi

import (
	"context"
	"fmt"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/printflow/printflow-bridge/internal/printflow"
)

// PollOctoPrint /api/job + /api/printer (X-Api-Key).
func PollOctoPrint(host string, port int, apiKey, serial string) (printflow.Telemetry, error) {
	h := map[string]string{"X-Api-Key": apiKey}
	port = portOr(port, 80)
	job, err := do("GET", host, port, "/api/job", h, nil)
	if err != nil {
		return printflow.Telemetry{}, fmt.Errorf("OctoPrint: %w", err)
	}
	if job.Status == 401 || job.Status == 403 {
		return printflow.Telemetry{}, fmt.Errorf("OctoPrint API anahtarı geçersiz — köprüyü yeniden eşleştirip erişim isteğini onaylayın")
	}
	var jobDoc map[string]any
	if job.Status >= 300 || job.json(&jobDoc) != nil {
		return printflow.Telemetry{}, fmt.Errorf("OctoPrint HTTP %d", job.Status)
	}
	var printerDoc map[string]any
	if pr, err := do("GET", host, port, "/api/printer", h, nil); err == nil && pr.Status == 200 {
		_ = pr.json(&printerDoc)
	}
	return OctoPrintTelemetry(serial, jobDoc, printerDoc), nil
}

// OctoPrintTelemetry /api/job (+ /api/printer) → telemetri.
func OctoPrintTelemetry(serial string, job, printer map[string]any) printflow.Telemetry {
	text := strings.ToLower(str(job["state"]))
	state := "idle"
	switch {
	case strings.Contains(text, "pausing") || strings.Contains(text, "paused"):
		state = "paused"
	case strings.Contains(text, "printing") || strings.Contains(text, "resuming") || strings.Contains(text, "finishing"):
		state = "printing"
	case strings.Contains(text, "error"):
		state = "error"
	case strings.Contains(text, "offline") || strings.Contains(text, "closed"):
		state = "offline"
	}
	file := obj(obj(job, "job"), "file")
	name := str(file["display"])
	if name == "" {
		name = str(file["name"])
	}
	prog := obj(job, "progress")
	temp := obj(printer, "temperature")
	return build("octoprint", serial, telemetryIn{
		state:     state,
		job:       name,
		progress:  num(prog["completion"]),
		printTime: num(prog["printTime"]),
		bed:       num(obj(temp, "bed")["actual"]),
		nozzle:    num(obj(temp, "tool0")["actual"]),
		chamber:   num(obj(temp, "chamber")["actual"]),
		errMsg:    str(job["error"]),
		raw:       map[string]any{"job": job, "printer": printer},
	})
}

// RequestAppKey OctoPrint Application Keys: kullanıcı OctoPrint arayüzünde "İzin ver" der → API anahtarı.
func RequestAppKey(ctx context.Context, host string, port int, app string, onWaiting func()) (string, error) {
	port = portOr(port, 80)
	res, err := do("POST", host, port, "/plugin/appkeys/request", nil, map[string]string{"app": app})
	if err != nil {
		return "", err
	}
	if res.Status == 404 {
		return "", fmt.Errorf("OctoPrint Application Keys eklentisi kapalı")
	}
	if res.Status != 201 {
		return "", fmt.Errorf("OctoPrint anahtar isteği HTTP %d", res.Status)
	}
	var body struct {
		AppToken string `json:"app_token"`
	}
	_ = res.json(&body)
	token := body.AppToken
	if token == "" {
		token = path.Base(res.Header.Get("Location"))
	}
	if token == "" || token == "." || token == "/" {
		return "", fmt.Errorf("OctoPrint app_token dönmedi")
	}
	if onWaiting != nil {
		onWaiting()
	}
	deadline := time.Now().Add(120 * time.Second)
	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-time.After(time.Second):
		}
		poll, err := do("GET", host, port, "/plugin/appkeys/request/"+url.PathEscape(token), nil, nil)
		if err != nil {
			continue
		}
		switch poll.Status {
		case 200:
			var k struct {
				APIKey string `json:"api_key"`
			}
			if poll.json(&k) == nil && k.APIKey != "" {
				return k.APIKey, nil
			}
		case 404:
			return "", fmt.Errorf("OctoPrint erişim isteği reddedildi veya süresi doldu")
		}
	}
	return "", fmt.Errorf("OctoPrint onayı zaman aşımına uğradı")
}
