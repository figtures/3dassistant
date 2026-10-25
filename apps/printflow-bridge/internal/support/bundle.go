package support

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"runtime"
	"strings"
	"time"

	"github.com/printflow/printflow-bridge/internal/config"
	"github.com/printflow/printflow-bridge/internal/discovery"
)

const schemaVersion = 1
const maxBundleBytes = 256 * 1024

var secretKeyRe = regexp.MustCompile(`(?i)^(access[_-]?code|password|api[_-]?key|bridge[_-]?token|token|secret|authorization|bambu[_-]?token)$`)

func redactToken(s string) string {
	if len(s) <= 2 {
		return "**"
	}
	n := len(s) - 2
	if n > 8 {
		n = 8
	}
	return s[:2] + strings.Repeat("*", n)
}

func RedactSecretsDeep(v interface{}) interface{} {
	return redactValue(v, 0)
}

func redactValue(v interface{}, depth int) interface{} {
	if depth > 12 {
		return v
	}
	switch x := v.(type) {
	case map[string]interface{}:
		out := map[string]interface{}{}
		for k, val := range x {
			if secretKeyRe.MatchString(k) {
				if s, ok := val.(string); ok {
					out[k] = redactToken(s)
					continue
				}
			}
			out[k] = redactValue(val, depth+1)
		}
		return out
	case []interface{}:
		arr := make([]interface{}, len(x))
		for i, item := range x {
			arr[i] = redactValue(item, depth+1)
		}
		return arr
	default:
		return v
	}
}

func SummarizeConfig(cfg *config.File) map[string]interface{} {
	if cfg == nil {
		return nil
	}
	printers := make([]map[string]interface{}, 0, len(cfg.Printers))
	for _, p := range cfg.Printers {
		printers = append(printers, map[string]interface{}{
			"machineId":     p.MachineID,
			"vendor":        p.Vendor,
			"serial":        p.Serial,
			"host":          p.Host,
			"mac":           p.MAC,
			"model":         p.Model,
			"hasAccessCode": p.AccessCode != "",
			"hasApiKey":     p.APIKey != "",
			"hasPassword":   p.Password != "",
		})
	}
	raw := map[string]interface{}{
		"printflowUrl":  cfg.PrintflowURL,
		"bridgeToken":   cfg.BridgeToken,
		"printerCount":  len(cfg.Printers),
		"printers":      printers,
	}
	if r, ok := RedactSecretsDeep(raw).(map[string]interface{}); ok {
		return r
	}
	return raw
}

func ReadLogTail(maxLines int) []string {
	path := logFilePath()
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	lines := strings.Split(strings.TrimSuffix(string(b), "\n"), "\n")
	if len(lines) <= maxLines {
		return lines
	}
	return lines[len(lines)-maxLines:]
}

func logFilePath() string {
	return strings.TrimSuffix(config.DefaultConfigPath(), "config.json") + "bridge.log"
}

func BuildBundle(ctx context.Context, agentVersion string) (map[string]interface{}, error) {
	cfg, _ := config.Load()
	opts := discovery.Options{Timeout: 6 * time.Second, Scan: "auto"}
	if cfg != nil {
		opts.Paired = cfg.Printers
	}
	res := discovery.Discover(ctx, opts)

	bundle := map[string]interface{}{
		"schemaVersion": schemaVersion,
		"agent":         agentVersion,
		"collectedAt":   time.Now().UTC().Format(time.RFC3339Nano),
		"os":            fmt.Sprintf("%s %s", runtime.GOOS, runtime.GOARCH),
		"arch":          runtime.GOARCH,
		"interfaces":    res.Interfaces,
		"configSummary": SummarizeConfig(cfg),
		"discovery": RedactSecretsDeep(map[string]interface{}{
			"printerCount": len(res.Printers),
			"warnings":     res.Warnings,
		}),
		"logTail": ReadLogTail(80),
	}

	if r, ok := RedactSecretsDeep(bundle).(map[string]interface{}); ok {
		return r, nil
	}
	return bundle, nil
}

func UploadBundle(cfg *config.File, bundle map[string]interface{}) (map[string]interface{}, error) {
	if cfg == nil || cfg.PrintflowURL == "" || cfg.BridgeToken == "" {
		return nil, fmt.Errorf("köprü yapılandırması eksik (printflowUrl / bridgeToken)")
	}
	body, err := json.Marshal(map[string]interface{}{"bundle": bundle})
	if err != nil {
		return nil, err
	}
	if len(body) > maxBundleBytes {
		return nil, fmt.Errorf("paket 256KB sınırını aşıyor")
	}
	url := strings.TrimRight(cfg.PrintflowURL, "/") + "/api/bridge/support-bundle"
	req, err := http.NewRequest(http.MethodPost, url, strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.BridgeToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("yükleme başarısız (%d): %s", resp.StatusCode, string(raw))
	}
	var out map[string]interface{}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}

