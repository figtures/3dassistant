package creality

import (
	"encoding/json"
	"testing"
)

func TestParseCrealityPayload_statusWrapper(t *testing.T) {
	raw := []byte(`{"Status":{"PrintProgress":55,"CurrentStatus":1,"GcodeName":"test.gcode"}}`)
	snap, err := parseCrealityPayload(raw)
	if err != nil {
		t.Fatal(err)
	}
	if snap.PrintProgress == nil || *snap.PrintProgress != 55 {
		t.Fatalf("progress: %v", snap.PrintProgress)
	}
	if snap.GcodeName != "test.gcode" {
		t.Fatalf("gcode: %s", snap.GcodeName)
	}
}

func TestMapSnapshot_printing(t *testing.T) {
	iot := iotSnapshot{PrintProgress: ptrF(33), Print: 1, GcodeName: "a.gcode"}
	tel := mapSnapshot("id", "K1", iot, true)
	if tel.PrinterState != "printing" {
		t.Fatalf("state %s", tel.PrinterState)
	}
	if tel.ProgressPercent == nil || *tel.ProgressPercent != 33 {
		t.Fatalf("progress %v", tel.ProgressPercent)
	}
}

func ptrF(v float64) *float64 { return &v }

func TestParseCrealityPayload_flat(t *testing.T) {
	var raw map[string]interface{}
	_ = json.Unmarshal([]byte(`{"printProgress":10,"print":1}`), &raw)
	s := mapFromGeneric(raw)
	if s.PrintProgress == nil {
		t.Fatal("expected progress")
	}
}
