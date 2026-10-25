package creality

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/printflow/printflow-bridge/internal/printflow"
)

type iotSnapshot struct {
	PrintProgress *float64    `json:"printProgress"`
	DProgress     *float64    `json:"dProgress"`
	Print         interface{} `json:"print"`
	State         interface{} `json:"state"`
	Pause         interface{} `json:"pause"`
	PrintJobTime  *int        `json:"printJobTime"`
	Err           interface{} `json:"err"`
	GcodeName     string      `json:"gcodeName"`
}

// Poll Creality OS (K1 / K2 / V3 KE): önce yerel WebSocket, yoksa HTTP snapshot.
func Poll(host string, port int, deviceID, label string) (printflow.Telemetry, error) {
	tel, err := pollWebSocket(host, port)
	if err == nil {
		return mapSnapshot(deviceID, label, tel, true), nil
	}
	tel2, err2 := pollHTTP(host)
	if err2 != nil {
		return printflow.Telemetry{}, fmt.Errorf("creality lan: %v; http: %v", err, err2)
	}
	return mapSnapshot(deviceID, label, tel2, true), nil
}

func pollWebSocket(host string, port int) (iotSnapshot, error) {
	addr := fmt.Sprintf("ws://%s:%d/", host, port)
	dialer := websocket.Dialer{HandshakeTimeout: 8 * time.Second}
	conn, _, err := dialer.Dial(addr, nil)
	if err != nil {
		return iotSnapshot{}, err
	}
	defer conn.Close()
	_ = conn.WriteJSON(map[string]string{"mode": "subscribe", "topic": "print"})
	_ = conn.WriteJSON(map[string]string{"mode": "subscribe", "topic": "status"})

	conn.SetReadDeadline(time.Now().Add(6 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		return iotSnapshot{}, err
	}
	return parseCrealityPayload(msg)
}

func pollHTTP(host string) (iotSnapshot, error) {
	client := &http.Client{Timeout: 8 * time.Second}
	urls := []string{
		fmt.Sprintf("http://%s/api/print/snapshot", host),
		fmt.Sprintf("http://%s/cgi-bin/get_dev_state", host),
	}
	for _, u := range urls {
		res, err := client.Get(u)
		if err != nil {
			continue
		}
		if res.StatusCode >= 300 {
			res.Body.Close()
			continue
		}
		var raw map[string]interface{}
		if err := json.NewDecoder(res.Body).Decode(&raw); err != nil {
			res.Body.Close()
			continue
		}
		res.Body.Close()
		return mapFromGeneric(raw), nil
	}
	return iotSnapshot{}, fmt.Errorf("http snapshot yok")
}

func parseCrealityPayload(msg []byte) (iotSnapshot, error) {
	var raw map[string]interface{}
	if err := json.Unmarshal(msg, &raw); err != nil {
		return iotSnapshot{}, err
	}
	if st, ok := raw["Status"].(map[string]interface{}); ok {
		return mapFromGeneric(st), nil
	}
	return mapFromGeneric(raw), nil
}

func mapFromGeneric(raw map[string]interface{}) iotSnapshot {
	var s iotSnapshot
	if v, ok := asFloat(raw["printProgress"]); ok {
		s.PrintProgress = &v
	}
	if v, ok := asFloat(raw["PrintProgress"]); ok {
		s.PrintProgress = &v
	}
	if v, ok := asFloat(raw["dProgress"]); ok {
		s.DProgress = &v
	}
	if v, ok := asFloat(raw["dprogress"]); ok {
		s.DProgress = &v
	}
	if v, ok := raw["print"]; ok {
		s.Print = v
	}
	if v, ok := raw["Print"]; ok {
		s.Print = v
	}
	if v, ok := raw["state"]; ok {
		s.State = v
	}
	if v, ok := raw["CurrentStatus"]; ok {
		s.State = v
	}
	if v, ok := raw["pause"]; ok {
		s.Pause = v
	}
	if v, ok := asInt(raw["printJobTime"]); ok {
		s.PrintJobTime = &v
	}
	if v, ok := raw["err"]; ok {
		s.Err = v
	}
	if name, ok := raw["gcodeName"].(string); ok {
		s.GcodeName = name
	}
	if name, ok := raw["GcodeName"].(string); ok {
		s.GcodeName = name
	}
	return s
}

func mapSnapshot(deviceID, label string, iot iotSnapshot, online bool) printflow.Telemetry {
	printerState := mapCrealityState(iot, online)
	active := printerState == "printing" || printerState == "paused"
	var progress *float64
	if iot.PrintProgress != nil {
		progress = iot.PrintProgress
	} else if iot.DProgress != nil {
		progress = iot.DProgress
	}
	var job *string
	if iot.GcodeName != "" {
		job = &iot.GcodeName
	} else if label != "" {
		job = &label
	}
	var printTime *int
	if iot.PrintJobTime != nil {
		printTime = iot.PrintJobTime
	}
	conn := "connected"
	if printerState == "offline" {
		conn = "disconnected"
	}
	if printerState == "error" {
		conn = "error"
	}
	var errMsg *string
	if printerState == "error" && iot.Err != nil {
		s := fmt.Sprint(iot.Err)
		errMsg = &s
	}
	if !active {
		job = nil
		progress = nil
		printTime = nil
	}
	return printflow.Telemetry{
		ConnectionStatus: conn,
		PrinterState:     printerState,
		JobName:          job,
		ProgressPercent:  progress,
		PrintTimeSeconds: printTime,
		ErrorMessage:     errMsg,
		Raw: map[string]interface{}{
			"vendor":   "creality",
			"deviceId": deviceID,
			"iot":      iot,
		},
	}
}

func mapCrealityState(iot iotSnapshot, online bool) string {
	if !online {
		return "offline"
	}
	if iot.Err != nil && fmt.Sprint(iot.Err) != "0" {
		return "error"
	}
	if isPaused(iot.Pause) {
		return "paused"
	}
	if isPrinting(iot.Print) {
		return "printing"
	}
	if st := fmt.Sprint(iot.State); st == "1" || strings.Contains(strings.ToLower(st), "print") {
		return "printing"
	}
	if st := fmt.Sprint(iot.State); st == "4" || strings.Contains(strings.ToLower(st), "pause") {
		return "paused"
	}
	if st := fmt.Sprint(iot.State); st == "2" {
		return "idle"
	}
	return "idle"
}

func isPrinting(v interface{}) bool {
	switch x := v.(type) {
	case float64:
		return x == 1
	case int:
		return x == 1
	case string:
		return x == "1" || strings.EqualFold(x, "printing")
	}
	return false
}

func isPaused(v interface{}) bool {
	switch x := v.(type) {
	case bool:
		return x
	case float64:
		return x == 1
	case int:
		return x == 1
	case string:
		return x == "1" || strings.EqualFold(x, "true")
	}
	return false
}

func asFloat(v interface{}) (float64, bool) {
	switch x := v.(type) {
	case float64:
		return x, true
	case int:
		return float64(x), true
	case string:
		if f, err := json.Number(x).Float64(); err == nil {
			return f, true
		}
	}
	return 0, false
}

func asInt(v interface{}) (int, bool) {
	switch x := v.(type) {
	case float64:
		return int(x), true
	case int:
		return x, true
	case string:
		var n int
		if _, err := fmt.Sscan(x, &n); err == nil {
			return n, true
		}
	}
	return 0, false
}
