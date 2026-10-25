package lanapi

import (
	"strings"
	"testing"
)

func TestKlipperTelemetry(t *testing.T) {
	tel := KlipperTelemetry("MAC1", map[string]any{
		"print_stats":    map[string]any{"state": "printing", "filename": "benchy.gcode", "print_duration": 120.0},
		"display_status": map[string]any{"progress": 0.4567},
		"extruder":       map[string]any{"temperature": 210.5},
		"heater_bed":     map[string]any{"temperature": 60.0},
	})
	if tel.PrinterState != "printing" || *tel.ProgressPercent != 45.7 || *tel.JobName != "benchy.gcode" {
		t.Fatalf("unexpected %+v", tel)
	}
	if *tel.NozzleTempC != 210.5 || *tel.BedTempC != 60 || *tel.PrintTimeSeconds != 120 {
		t.Fatalf("temps %+v", tel)
	}
	idle := KlipperTelemetry("MAC1", map[string]any{"print_stats": map[string]any{"state": "complete", "filename": "x"}})
	if idle.PrinterState != "idle" || idle.JobName != nil {
		t.Fatalf("idle %+v", idle)
	}
}

func TestOctoPrintTelemetry(t *testing.T) {
	tel := OctoPrintTelemetry("op", map[string]any{
		"state":    "Printing from SD",
		"job":      map[string]any{"file": map[string]any{"name": "a.gcode", "display": "A"}},
		"progress": map[string]any{"completion": 12.34, "printTime": 30.0},
	}, map[string]any{"temperature": map[string]any{"tool0": map[string]any{"actual": 200.0}}})
	if tel.PrinterState != "printing" || *tel.JobName != "A" || *tel.ProgressPercent != 12.3 || *tel.NozzleTempC != 200 {
		t.Fatalf("unexpected %+v", tel)
	}
	if OctoPrintTelemetry("op", map[string]any{"state": "Offline"}, nil).ConnectionStatus != "disconnected" {
		t.Fatal("offline")
	}
}

func TestPrusaLinkTelemetryAndDigest(t *testing.T) {
	tel := PrusaLinkTelemetry("SN", map[string]any{
		"printer": map[string]any{"state": "PRINTING", "temp_bed": 60.0, "temp_nozzle": 215.0},
		"job":     map[string]any{"progress": 50.0, "time_printing": 600.0},
	}, "part.bgcode")
	if tel.PrinterState != "printing" || *tel.ProgressPercent != 50 || *tel.JobName != "part.bgcode" {
		t.Fatalf("unexpected %+v", tel)
	}
	att := PrusaLinkTelemetry("SN", map[string]any{"printer": map[string]any{"state": "ATTENTION"}}, "")
	if att.PrinterState != "error" || att.ErrorMessage == nil {
		t.Fatalf("attention %+v", att)
	}

	ch := ParseDigestChallenge(`Digest realm="Printer API", nonce="abc123", qop="auth", opaque="xyz"`)
	if ch["realm"] != "Printer API" || ch["nonce"] != "abc123" || ch["qop"] != "auth" {
		t.Fatalf("challenge %v", ch)
	}
	if ParseDigestChallenge(`Basic realm="x"`) != nil {
		t.Fatal("basic should be nil")
	}
	// RFC 2617 örneği (qop=auth): Mufasa / Circle Of Life → 6629fae49393a05397450978507c4ef1
	rfc := ParseDigestChallenge(`Digest realm="testrealm@host.com", qop="auth", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", opaque="5ccc069c403ebaf9f0171e9517f40e41"`)
	h := DigestAuthorization("Mufasa", "Circle Of Life", "GET", "/dir/index.html", rfc, 1, "0a4f113b")
	if !strings.Contains(h, `response="6629fae49393a05397450978507c4ef1"`) || !strings.Contains(h, "nc=00000001") {
		t.Fatalf("digest %s", h)
	}
}

func TestSDCPTelemetry(t *testing.T) {
	tel := SDCPTelemetry("MB1", map[string]any{
		"CurrentStatus": []any{1.0},
		"PrintInfo":     map[string]any{"Status": 13.0, "Filename": "cube.ctb", "CurrentTicks": 50.0, "TotalTicks": 200.0},
		"TempOfHotbed":  55.0,
	})
	if tel.PrinterState != "printing" || *tel.ProgressPercent != 25 || *tel.JobName != "cube.ctb" || *tel.BedTempC != 55 {
		t.Fatalf("unexpected %+v", tel)
	}
	paused := SDCPTelemetry("MB1", map[string]any{"CurrentStatus": []any{1.0}, "PrintInfo": map[string]any{"Status": 6.0}})
	if paused.PrinterState != "paused" {
		t.Fatalf("paused %+v", paused)
	}
	if SDCPTelemetry("MB1", map[string]any{"CurrentStatus": 0.0}).PrinterState != "idle" {
		t.Fatal("idle")
	}
}

func TestParseFlashforgeStatus(t *testing.T) {
	s := ParseFlashforgeStatus(
		"CMD M119 Received.\r\nEndstop: X-max:0\r\nMachineStatus: BUILDING_FROM_SD\r\nMoveMode: MOVING\r\nCurrentFile: box.gx\r\nok\r\n",
		"CMD M27 Received.\r\nSD printing byte 25/100\r\nok\r\n",
		"CMD M105 Received.\r\nT0:210 /210 B:60/60\r\nok\r\n",
	)
	if s.State != "printing" || s.File != "box.gx" || *s.Progress != 25 || *s.Nozzle != 210 || *s.Bed != 60 {
		t.Fatalf("unexpected %+v", s)
	}
	if ParseFlashforgeStatus("MachineStatus: BUILDING_COMPLETED", "", "").State != "idle" {
		t.Fatal("completed should be idle")
	}
	if ParseFlashforgeStatus("MachineStatus: PAUSED", "", "").State != "paused" {
		t.Fatal("paused")
	}
}
