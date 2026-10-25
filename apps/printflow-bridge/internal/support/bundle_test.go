package support

import (
	"testing"

	"github.com/printflow/printflow-bridge/internal/config"
)

func TestRedactSecretsDeep(t *testing.T) {
	raw := map[string]interface{}{
		"bridgeToken": "abcdefghijklmnop",
		"nested": map[string]interface{}{
			"accessCode": "12345678",
		},
	}
	out := RedactSecretsDeep(raw).(map[string]interface{})
	if out["bridgeToken"] != "ab********" {
		t.Fatalf("bridgeToken redacted: %v", out["bridgeToken"])
	}
	nested := out["nested"].(map[string]interface{})
	if nested["accessCode"] != "12******" {
		t.Fatalf("accessCode redacted: %v", nested["accessCode"])
	}
}

func TestSummarizeConfigNoSecrets(t *testing.T) {
	cfg := &config.File{
		BridgeToken: "secret-token-value",
		Printers: []config.PrinterEntry{
			{AccessCode: "9999", Vendor: "bambu"},
		},
	}
	sum := SummarizeConfig(cfg)
	if sum["bridgeToken"] == "secret-token-value" {
		t.Fatal("plain token leaked")
	}
	printers := sum["printers"].([]map[string]interface{})
	if len(printers) != 1 {
		t.Fatalf("expected 1 printer summary, got %d", len(printers))
	}
	if printers[0]["hasAccessCode"] != true {
		t.Fatal("expected hasAccessCode flag")
	}
	if _, ok := printers[0]["accessCode"]; ok {
		t.Fatal("access code should not appear in summary")
	}
}
