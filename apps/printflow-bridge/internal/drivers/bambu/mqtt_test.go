package bambu

import (
	"errors"
	"regexp"
	"strings"
	"testing"
)

func TestFingerprintFormat(t *testing.T) {
	fp := FingerprintSHA256([]byte("cert"))
	if !regexp.MustCompile(`^([0-9A-F]{2}:){31}[0-9A-F]{2}$`).MatchString(fp) {
		t.Fatalf("format %s", fp)
	}
}

func TestErrorMessage(t *testing.T) {
	cases := map[string]string{
		"not Authorized": "erişim kodu hatalı",
		"dial tcp 1.2.3.4:8883: connect: connection refused": "LAN Only",
		"mqtt timeout": "yanıt vermiyor",
	}
	for in, want := range cases {
		if got := ErrorMessage(errors.New(in)); !strings.Contains(got, want) {
			t.Fatalf("%q → %q (want %q)", in, got, want)
		}
	}
}
