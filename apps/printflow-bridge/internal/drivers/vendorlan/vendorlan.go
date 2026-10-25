package vendorlan

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/printflow/printflow-bridge/internal/drivers/creality"
	"github.com/printflow/printflow-bridge/internal/printflow"
)

type profile struct {
	httpPort  int
	https     bool
	wsPort    int
	httpPaths []string
}

func profileFor(vendor string) profile {
	switch strings.ToLower(vendor) {
	case "creality":
		return profile{wsPort: 9999, httpPort: 80, httpPaths: []string{"/api/print/snapshot", "/cgi-bin/get_dev_state"}}
	case "anycubic":
		return profile{
			wsPort:    6000,
			httpPort:  8080,
			httpPaths: []string{"/api/printer/status", "/api/v1/printer/status", "/printer/api/status"},
		}
	case "elegoo":
		return profile{
			httpPort:  80,
			httpPaths: []string{"/status", "/api/status", "/printer/status"},
		}
	case "flashforge":
		return profile{
			httpPort:  8899,
			httpPaths: []string{"/api/detail", "/api/status", "/detail"},
		}
	case "snapmaker":
		return profile{
			httpPort:  8080,
			https:     true,
			httpPaths: []string{"/api/v1/status", "/api/status", "/sm/status"},
		}
	default:
		return profile{httpPort: 80, httpPaths: []string{"/api/status"}}
	}
}

// Poll yerel ağ — markaya özel port/yol; Creality mevcut sürücüye delegasyon.
func Poll(vendor, host string, lanPort int, deviceID, label string) (printflow.Telemetry, error) {
	v := strings.ToLower(vendor)
	if v == "creality" {
		port := lanPort
		if port == 0 {
			port = 9999
		}
		return creality.Poll(host, port, deviceID, label)
	}
	p := profileFor(v)
	if lanPort > 0 {
		if p.wsPort > 0 && (lanPort == p.wsPort || lanPort != p.httpPort) {
			p.wsPort = lanPort
		} else {
			p.httpPort = lanPort
		}
	}
	if tel, err := tryWebSocket(host, p); err == nil {
		return mapGeneric(v, deviceID, label, tel, true), nil
	}
	raw, err := tryHTTP(host, p)
	if err != nil {
		return printflow.Telemetry{}, err
	}
	return mapGeneric(v, deviceID, label, raw, true), nil
}

func tryWebSocket(host string, p profile) (map[string]interface{}, error) {
	if p.wsPort == 0 {
		return nil, fmt.Errorf("ws kapalı")
	}
	addr := fmt.Sprintf("ws://%s:%d/", host, p.wsPort)
	dialer := websocket.Dialer{HandshakeTimeout: 8 * time.Second}
	conn, _, err := dialer.Dial(addr, nil)
	if err != nil {
		return nil, err
	}
	defer conn.Close()
	_ = conn.WriteJSON(map[string]string{"mode": "subscribe", "topic": "print"})
	conn.SetReadDeadline(time.Now().Add(6 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		return nil, err
	}
	var raw map[string]interface{}
	if err := json.Unmarshal(msg, &raw); err != nil {
		return nil, err
	}
	if st, ok := raw["Status"].(map[string]interface{}); ok {
		return st, nil
	}
	return raw, nil
}

func tryHTTP(host string, p profile) (map[string]interface{}, error) {
	scheme := "http"
	if p.https {
		scheme = "https"
	}
	port := p.httpPort
	if port == 0 {
		port = 80
	}
	client := &http.Client{
		Timeout: 8 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}
	for _, path := range p.httpPaths {
		url := fmt.Sprintf("%s://%s:%d%s", scheme, host, port, path)
		res, err := client.Get(url)
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
		return raw, nil
	}
	return nil, fmt.Errorf("http snapshot yok")
}

func mapGeneric(vendor, deviceID, label string, raw map[string]interface{}, online bool) printflow.Telemetry {
	state := strings.ToLower(firstString(raw,
		"status", "Status", "state", "State", "printStatus", "machineStatus", "currentStatus"))
	progress := firstFloat(raw,
		"progress", "Progress", "printProgress", "PrintProgress", "percent", "dProgress", "dprogress")
	job := firstString(raw, "jobName", "fileName", "gcodeName", "GcodeName", "file", "taskName")
	if job == "" {
		job = label
	}

	printerState := "idle"
	switch {
	case strings.Contains(state, "print") || state == "1" || state == "running":
		printerState = "printing"
	case strings.Contains(state, "pause") || state == "4":
		printerState = "paused"
	case strings.Contains(state, "error") || strings.Contains(state, "fail"):
		printerState = "error"
	case strings.Contains(state, "offline"):
		printerState = "offline"
	case !online:
		printerState = "offline"
	}
	active := printerState == "printing" || printerState == "paused"
	var jobPtr *string
	var progPtr *float64
	if active {
		if job != "" {
			jobPtr = &job
		}
		if progress != nil {
			progPtr = progress
		}
	}
	conn := "connected"
	if printerState == "offline" {
		conn = "disconnected"
	}
	if printerState == "error" {
		conn = "error"
	}
	return printflow.Telemetry{
		ConnectionStatus: conn,
		PrinterState:     printerState,
		JobName:          jobPtr,
		ProgressPercent:  progPtr,
		PrintTimeSeconds: nil,
		ErrorMessage:     nil,
		Raw: map[string]interface{}{
			"vendor":   vendor,
			"deviceId": deviceID,
			"lan":      raw,
		},
	}
}

func firstString(m map[string]interface{}, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k]; ok {
			if s, ok := v.(string); ok && s != "" {
				return s
			}
			if n, ok := v.(float64); ok {
				return fmt.Sprintf("%.0f", n)
			}
		}
	}
	if data, ok := m["data"].(map[string]interface{}); ok {
		return firstString(data, keys...)
	}
	return ""
}

func firstFloat(m map[string]interface{}, keys ...string) *float64 {
	for _, k := range keys {
		if v, ok := m[k]; ok {
			switch x := v.(type) {
			case float64:
				return &x
			case int:
				f := float64(x)
				return &f
			case string:
				var f float64
				if _, err := fmt.Sscan(x, &f); err == nil {
					return &f
				}
			}
		}
	}
	if data, ok := m["data"].(map[string]interface{}); ok {
		return firstFloat(data, keys...)
	}
	return nil
}
