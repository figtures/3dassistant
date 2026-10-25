package printflow

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

func NewClient(baseURL, token string) *Client {
	return &Client{
		baseURL: baseURL,
		token:   token,
		http:    &http.Client{Timeout: 30 * time.Second},
	}
}

type Telemetry struct {
	ConnectionStatus string                 `json:"connectionStatus"`
	PrinterState     string                 `json:"printerState"`
	JobName          *string                `json:"jobName"`
	ProgressPercent  *float64               `json:"progressPercent"`
	PrintTimeSeconds *int                   `json:"printTimeSeconds"`
	ErrorMessage     *string                `json:"errorMessage"`
	BedTempC         *float64               `json:"bedTempC"`
	NozzleTempC      *float64               `json:"nozzleTempC"`
	ChamberTempC     *float64               `json:"chamberTempC"`
	CameraStreamURL  *string                `json:"cameraStreamUrl"`
	Raw              map[string]interface{} `json:"raw"`
}

// PatchBindingHost DHCP sonrası yazıcının yeni LAN adresini buluttaki bağlamaya yazar.
func (c *Client) PatchBindingHost(machineID, host string) error {
	body, _ := json.Marshal(map[string]string{"machineId": machineID, "host": host})
	req, err := http.NewRequest(http.MethodPatch, c.baseURL+"/api/bridge/bindings", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.token)
	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("bindings %d: %s", res.StatusCode, string(b))
	}
	return nil
}

func (c *Client) PushTelemetry(machineID string, t Telemetry) error {
	body, _ := json.Marshal(map[string]interface{}{
		"machineId": machineID,
		"telemetry": t,
	})
	req, err := http.NewRequest(http.MethodPost, c.baseURL+"/api/bridge/telemetry", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.token)
	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		b, _ := io.ReadAll(res.Body)
		return fmt.Errorf("telemetry %d: %s", res.StatusCode, string(b))
	}
	return nil
}

type PairRequest struct {
	BaseURL      string
	Code         string
	BridgeToken  string
	AgentVersion string
	MachineName  string
	Vendor       string
	Serial       string
	Host         string
	Label        string
	Model        string
}

type PairResult struct {
	BaseURL     string
	BridgeToken string
	MachineID   string
}

// PairError eşleştirme API hatası (401 kod / 402 plan → diğer yazıcılar denenmez).
type PairError struct {
	Status  int
	Message string
}

func (e *PairError) Error() string { return "pair: " + e.Message }

func Pair(req PairRequest) (PairResult, error) {
	base := req.BaseURL
	if len(base) > 0 && base[len(base)-1] == '/' {
		base = base[:len(base)-1]
	}
	payload := map[string]interface{}{
		"code":         req.Code,
		"agentVersion": req.AgentVersion,
		"printer": map[string]string{
			"vendor": req.Vendor,
			"serial": req.Serial,
			"host":   req.Host,
			"label":  req.Label,
			"model":  req.Model,
		},
	}
	if req.MachineName != "" {
		payload["machineName"] = req.MachineName
	}
	if req.BridgeToken != "" {
		payload["bridgeToken"] = req.BridgeToken
	}
	b, _ := json.Marshal(payload)
	httpReq, err := http.NewRequest(http.MethodPost, base+"/api/bridge/pair", bytes.NewReader(b))
	if err != nil {
		return PairResult{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 45 * time.Second}
	res, err := client.Do(httpReq)
	if err != nil {
		return PairResult{}, err
	}
	defer res.Body.Close()
	var data map[string]interface{}
	_ = json.NewDecoder(res.Body).Decode(&data)
	if res.StatusCode >= 300 {
		msg, _ := data["error"].(string)
		if msg == "" {
			msg = res.Status
		}
		if res.StatusCode == http.StatusUnauthorized && strings.Contains(strings.ToLower(msg), "kod") {
			msg = "Eşleştirme kodu geçersiz veya süresi doldu — panelden yeni kod alın"
		}
		return PairResult{}, &PairError{Status: res.StatusCode, Message: msg}
	}
	token, _ := data["bridgeToken"].(string)
	machineID, _ := data["machineId"].(string)
	if token == "" || machineID == "" {
		return PairResult{}, fmt.Errorf("pair: eksik yanıt")
	}
	return PairResult{BaseURL: base, BridgeToken: token, MachineID: machineID}, nil
}
