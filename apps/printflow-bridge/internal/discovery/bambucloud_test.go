package discovery

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const bindBody = `{"message":"success","devices":[
 {"dev_id":"20P6BJ651701805","name":"X2D","dev_access_code":"Q1W2E3R4","dev_product_name":"X2D"},
 {"dev_id":"bad","dev_access_code":"12345678"},
 {"dev_id":"01P00A123456789","dev_access_code":""}]}`

func TestAccessCodesFromBind(t *testing.T) {
	codes := AccessCodesFromBind([]byte(bindBody))
	if len(codes) != 1 || codes["20P6BJ651701805"] != "Q1W2E3R4" {
		t.Fatalf("%v", codes)
	}
	if len(AccessCodesFromBind([]byte("nope"))) != 0 {
		t.Fatal("garbage parsed")
	}
}

func withBambuAPI(t *testing.T, status int, body string, seen *string) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*seen = r.URL.Path + " " + r.Header.Get("Authorization")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	prev := BambuAPIBases["global"]
	BambuAPIBases["global"] = srv.URL
	t.Cleanup(func() { BambuAPIBases["global"] = prev })
}

func cloudResult() Result {
	printers := finalizeCandidates(mergeCandidates([]candidate{{
		Vendor: "bambu", Host: "192.168.1.151", Serial: "20P6BJ651701805", Methods: []string{"ssdp"},
		Confidence: 0.95, Extra: map[string]any{"connectMode": "cloud"},
	}}), nil, nil)
	return Result{Printers: printers, Warnings: []string{}}
}

func TestApplyBambuCloudWithToken(t *testing.T) {
	var seen string
	withBambuAPI(t, 200, bindBody, &seen)
	res := cloudResult()
	if !res.Printers[0].CloudAlternative || res.Printers[0].SecretAvailable {
		t.Fatalf("before: %+v", res.Printers[0])
	}
	codes := applyBambuCloud(context.Background(), &res, CloudOptions{Token: "tok-123"}, nil)
	if seen != "/v1/iot-service/api/user/bind Bearer tok-123" {
		t.Fatalf("request: %q", seen)
	}
	if codes["20P6BJ651701805"] != "Q1W2E3R4" || !res.Printers[0].SecretAvailable || res.BambuCloud.CodesFound != 1 {
		t.Fatalf("after: %+v %+v", res.Printers[0], res.BambuCloud)
	}
	b, _ := json.Marshal(res)
	if strings.Contains(string(b), "Q1W2E3R4") || strings.Contains(string(b), "tok-123") {
		t.Fatalf("secret leaked: %s", b)
	}
	if !strings.Contains(string(b), `"tokenSource":"token"`) || !strings.Contains(string(b), `"cloudAlternative":true`) {
		t.Fatalf("schema: %s", b)
	}
}

func TestApplyBambuCloudAuthError(t *testing.T) {
	var seen string
	withBambuAPI(t, 401, `{}`, &seen)
	res := cloudResult()
	applyBambuCloud(context.Background(), &res, CloudOptions{Token: "expired-token"}, nil)
	if res.Printers[0].SecretAvailable || res.BambuCloud.Error == nil || !strings.Contains(*res.BambuCloud.Error, "geçersiz") {
		t.Fatalf("%+v", res.BambuCloud)
	}
}

func TestSlicerSessionConsent(t *testing.T) {
	dir := t.TempDir()
	engine := filepath.Join(dir, "BambuNetworkEngine.conf")
	paths := []slicerPath{{"BambuStudio", engine}, {"BambuStudio", filepath.Join(dir, "BambuStudio.conf")}}

	res := cloudResult()
	applyBambuCloud(context.Background(), &res, CloudOptions{SlicerToken: "ask"}, paths)
	if *res.BambuCloud.SlicerSession != "missing" {
		t.Fatalf("%+v", res.BambuCloud)
	}

	if err := os.WriteFile(engine, []byte{0x8f, 0x01, 0xfe, 0x22, 0x10}, 0o600); err != nil {
		t.Fatal(err)
	}
	res = cloudResult()
	applyBambuCloud(context.Background(), &res, CloudOptions{SlicerToken: "ask"}, paths)
	if *res.BambuCloud.SlicerSession != "present" || res.BambuCloud.TokenSource != nil || len(res.Warnings) != 1 {
		t.Fatalf("no consent must not read: %+v %v", res.BambuCloud, res.Warnings)
	}
	res = cloudResult()
	applyBambuCloud(context.Background(), &res, CloudOptions{SlicerToken: "ask", Consent: func(string) bool { return true }}, paths)
	if *res.BambuCloud.SlicerSession != "encrypted" || res.BambuCloud.TokenSource != nil {
		t.Fatalf("encrypted: %+v", res.BambuCloud)
	}

	var seen string
	withBambuAPI(t, 200, bindBody, &seen)
	if err := os.WriteFile(engine, []byte(`{"user":{"access_token":"abcdefghijklmnopqrstuvwxyz0123"}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	res = cloudResult()
	codes := applyBambuCloud(context.Background(), &res, CloudOptions{SlicerToken: "use"}, paths)
	if *res.BambuCloud.TokenSource != "slicer" || codes["20P6BJ651701805"] == "" || !strings.HasSuffix(seen, "abcdefghijklmnopqrstuvwxyz0123") {
		t.Fatalf("slicer token: %+v %q", res.BambuCloud, seen)
	}
}

func TestSlicerPathsFlatpak(t *testing.T) {
	linux := slicerConfigPaths("linux", func(string) string { return "" }, "/home/u")
	var got []string
	for _, p := range linux {
		got = append(got, p.Path)
	}
	joined := strings.Join(got, "\n")
	for _, want := range []string{
		"/home/u/.config/BambuStudio/BambuStudio.conf",
		"/home/u/.var/app/com.bambulab.BambuStudio/config/BambuStudio/BambuStudio.conf",
		"/home/u/.var/app/io.github.softfever.OrcaSlicer/config/OrcaSlicer/OrcaSlicer.conf",
	} {
		if !strings.Contains(joined, want) {
			t.Fatalf("missing %s in %v", want, got)
		}
	}
	if n := len(slicerConfigPaths("darwin", func(string) string { return "" }, "/Users/u")); n != 2 {
		t.Fatalf("darwin paths: %d", n)
	}
}
