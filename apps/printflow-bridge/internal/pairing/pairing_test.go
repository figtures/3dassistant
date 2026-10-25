package pairing

import (
	"bytes"
	"strings"
	"testing"

	"github.com/printflow/printflow-bridge/internal/discovery"
)

func TestParseSelection(t *testing.T) {
	idx, action, err := ParseSelection("3, 1,1", 3)
	if err != nil || action != "" || len(idx) != 2 || idx[0] != 0 || idx[1] != 2 {
		t.Fatalf("got %v %q %v", idx, action, err)
	}
	if idx, _, err := ParseSelection("2-4", 4); err != nil || len(idx) != 3 || idx[0] != 1 {
		t.Fatalf("range %v %v", idx, err)
	}
	for _, a := range []string{"a", "Q", " m ", "r"} {
		if _, action, err := ParseSelection(a, 2); err != nil || action != strings.ToLower(strings.TrimSpace(a)) {
			t.Fatalf("%q → %q %v", a, action, err)
		}
	}
	for _, bad := range []string{"0", "5", "x", "", "3-1"} {
		if _, _, err := ParseSelection(bad, 4); err == nil {
			t.Fatalf("%q should fail", bad)
		}
	}
}

func TestValidCode(t *testing.T) {
	if !ValidCode("012345") || ValidCode("12345") || ValidCode("12a456") {
		t.Fatal("code validation")
	}
}

func TestPrintTable(t *testing.T) {
	var buf bytes.Buffer
	PrintTable(&buf, []discovery.Printer{
		{Vendor: "bambu", VendorLabel: "Bambu Lab", Host: "192.168.1.151", Serial: "20P6BJ651701805", Supported: true, NeedsSecret: discovery.SecretBambuAccessCode},
		{Vendor: "ultimaker", VendorLabel: "UltiMaker", Host: "192.168.1.9"},
		{Vendor: "creality", VendorLabel: "Creality", Host: "192.168.1.148", Supported: true, Paired: true},
	})
	out := buf.String()
	for _, want := range []string{"1) Bambu Lab", "erişim kodu sorulacak", "[desteklenmiyor]", "[zaten eşleşmiş]"} {
		if !strings.Contains(out, want) {
			t.Fatalf("missing %q in\n%s", want, out)
		}
	}
	buf.Reset()
	PrintTable(&buf, nil)
	if !strings.Contains(buf.String(), "bulunamadı") {
		t.Fatal("empty message")
	}
}
