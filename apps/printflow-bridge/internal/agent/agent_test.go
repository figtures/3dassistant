package agent

import "testing"

func TestParseDeepLink(t *testing.T) {
	code, base, err := ParseDeepLink("printflow://pair?code=123456&url=https%3A%2F%2Fapp.example.com%2F")
	if err != nil || code != "123456" || base != "https://app.example.com" {
		t.Fatalf("got %q %q %v", code, base, err)
	}
	for _, bad := range []string{
		"https://pair?code=123456&url=https://x",
		"printflow://pair?code=12&url=https://x",
		"printflow://pair?code=123456&url=javascript:alert(1)",
		"printflow://other?code=123456&url=https://x",
	} {
		if _, _, err := ParseDeepLink(bad); err == nil {
			t.Fatalf("%q should fail", bad)
		}
	}
}
