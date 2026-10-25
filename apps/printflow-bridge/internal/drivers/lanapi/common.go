// Package lanapi yazılım katmanı üzerinden okunan yazıcılar: Klipper (Moonraker), OctoPrint, PrusaLink.
package lanapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/printflow/printflow-bridge/internal/printflow"
)

var httpClient = &http.Client{Timeout: 8 * time.Second}

type response struct {
	Status int
	Header http.Header
	Body   []byte
}

func (r *response) json(v any) error { return json.Unmarshal(r.Body, v) }

func do(method, host string, port int, path string, headers map[string]string, body any) (*response, error) {
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, fmt.Sprintf("http://%s%s", net.JoinHostPort(host, strconv.Itoa(port)), path), rd)
	if err != nil {
		return nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	res, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(res.Body, 2<<20))
	return &response{Status: res.StatusCode, Header: res.Header, Body: b}, nil
}

func portOr(p, def int) int {
	if p > 0 {
		return p
	}
	return def
}

func num(v any) *float64 {
	switch x := v.(type) {
	case float64:
		return &x
	case string:
		if f, err := strconv.ParseFloat(x, 64); err == nil {
			return &f
		}
	}
	return nil
}

func str(v any) string {
	s, _ := v.(string)
	return s
}

func obj(m map[string]any, key string) map[string]any {
	o, _ := m[key].(map[string]any)
	if o == nil {
		return map[string]any{}
	}
	return o
}

type telemetryIn struct {
	state     string
	job       string
	progress  *float64
	printTime *float64
	bed       *float64
	nozzle    *float64
	chamber   *float64
	errMsg    string
	raw       any
}

func build(vendor, serial string, in telemetryIn) printflow.Telemetry {
	active := in.state == "printing" || in.state == "paused"
	t := printflow.Telemetry{
		ConnectionStatus: "connected",
		PrinterState:     in.state,
		BedTempC:         in.bed,
		NozzleTempC:      in.nozzle,
		ChamberTempC:     in.chamber,
		Raw:              map[string]interface{}{"vendor": vendor, "deviceId": serial, "lan": in.raw},
	}
	switch in.state {
	case "error":
		t.ConnectionStatus = "error"
		msg := in.errMsg
		if msg == "" {
			msg = "Yazıcı hata durumu"
		}
		t.ErrorMessage = &msg
	case "offline":
		t.ConnectionStatus = "disconnected"
	}
	if active {
		if in.job != "" {
			j := in.job
			t.JobName = &j
		}
		if in.progress != nil {
			p := math.Round(*in.progress*10) / 10
			t.ProgressPercent = &p
		}
		if in.printTime != nil {
			s := int(*in.printTime)
			t.PrintTimeSeconds = &s
		}
	}
	return t
}
