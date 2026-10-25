package lanapi

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"time"

	"github.com/gorilla/websocket"
	"github.com/printflow/printflow-bridge/internal/printflow"
)

// SDCPStatusRequest Elegoo SDCP v3 durum isteği (Cmd 0).
func SDCPStatusRequest(mainboardID string) map[string]any {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return map[string]any{
		"Id": "",
		"Data": map[string]any{
			"Cmd":         0,
			"Data":        map[string]any{},
			"RequestID":   hex.EncodeToString(b),
			"MainboardID": mainboardID,
			"TimeStamp":   time.Now().Unix(),
			"From":        0,
		},
		"Topic": "sdcp/request/" + mainboardID,
	}
}

// SDCPTelemetry SDCP Status nesnesi → telemetri.
func SDCPTelemetry(serial string, status map[string]any) printflow.Telemetry {
	printing := false
	switch cur := status["CurrentStatus"].(type) {
	case []any:
		for _, v := range cur {
			if f := num(v); f != nil && *f == 1 {
				printing = true
			}
		}
	default:
		if f := num(cur); f != nil && *f == 1 {
			printing = true
		}
	}
	pi := obj(status, "PrintInfo")
	state := "idle"
	if printing {
		state = "printing"
		if ps := num(pi["Status"]); ps != nil {
			switch *ps {
			case 5, 6:
				state = "paused"
			case 8, 9:
				state = "idle"
			}
		}
	}
	progress := num(pi["Progress"])
	if progress == nil {
		if cur, tot := num(pi["CurrentTicks"]), num(pi["TotalTicks"]); cur != nil && tot != nil && *tot > 0 {
			v := *cur / *tot * 100
			progress = &v
		}
	}
	return build("elegoo", serial, telemetryIn{
		state:     state,
		job:       str(pi["Filename"]),
		progress:  progress,
		printTime: num(pi["CurrentTicks"]),
		bed:       num(status["TempOfHotbed"]),
		nozzle:    num(status["TempOfNozzle"]),
		chamber:   num(status["TempOfBox"]),
		raw:       status,
	})
}

// PollElegooSDCP ws://host:3030/websocket üzerinden tek durum mesajı.
func PollElegooSDCP(host, serial string) (printflow.Telemetry, error) {
	dialer := websocket.Dialer{HandshakeTimeout: 5 * time.Second}
	conn, _, err := dialer.Dial(fmt.Sprintf("ws://%s/websocket", net.JoinHostPort(host, "3030")), nil)
	if err != nil {
		return printflow.Telemetry{}, fmt.Errorf("SDCP: %w", err)
	}
	defer conn.Close()
	_ = conn.SetReadDeadline(time.Now().Add(7 * time.Second))
	if err := conn.WriteJSON(SDCPStatusRequest(serial)); err != nil {
		return printflow.Telemetry{}, err
	}
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			return printflow.Telemetry{}, fmt.Errorf("SDCP zaman aşımı: %w", err)
		}
		var doc map[string]any
		if json.Unmarshal(msg, &doc) != nil {
			continue
		}
		status, _ := doc["Status"].(map[string]any)
		if status == nil {
			status, _ = obj(doc, "Data")["Status"].(map[string]any)
		}
		if status != nil {
			return SDCPTelemetry(serial, status), nil
		}
	}
}
