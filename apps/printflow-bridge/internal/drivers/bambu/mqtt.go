package bambu

import (
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/printflow/printflow-bridge/internal/printflow"
)

type Config struct {
	Host          string
	Serial        string
	AccessCode    string
	TLSServerName string
	TLSInsecure   bool
	// İlk bağlantıda kaydedilen sertifika parmak izi ("AA:BB:…"); boşsa TOFU.
	CertSHA256 string
}

var serialLike = regexp.MustCompile(`^[0-9A-Z]{8,20}$`)

// FingerprintSHA256 DER sertifika → "AA:BB:…" (Node fingerprint256 ile aynı biçim).
func FingerprintSHA256(der []byte) string {
	sum := sha256.Sum256(der)
	parts := make([]string, len(sum))
	for i, b := range sum {
		parts[i] = fmt.Sprintf("%02X", b)
	}
	return strings.Join(parts, ":")
}

// ErrorMessage MQTT/TLS hatalarını kullanıcıya anlamlı Türkçe mesaja çevirir.
func ErrorMessage(err error) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	low := strings.ToLower(msg)
	switch {
	case strings.Contains(low, "not authorized") || strings.Contains(low, "bad user name or password"):
		return "Bambu erişim kodu hatalı (yazıcı ekranı → Ayarlar → WLAN/LAN Only → Access Code; kod yenilendiyse güncelleyin)"
	case strings.Contains(low, "connection refused"):
		return "Bambu 8883 bağlantıyı reddetti: LAN Only modu (yeni firmware'de Developer Mode) kapalı olabilir"
	case strings.Contains(low, "sertifika") || strings.Contains(low, "farklı"):
		return msg
	case strings.Contains(low, "timeout") || strings.Contains(low, "no route") || strings.Contains(low, "unreachable") || strings.Contains(low, "deadline"):
		return "Bambu yazıcı yanıt vermiyor (kapalı veya IP değişmiş olabilir)"
	}
	return "Bambu MQTT: " + msg
}

// Snapshot tek MQTT report mesajı okur. Gözlenen sertifika parmak izini de döner (TOFU kaydı için).
//
// Bambu yazıcılar kendi CA'larıyla imzalı sertifika kullanır (sistem güven deposunda yok): ilk bağlantıda
// parmak izi kaydedilir, sonrakilerde eşleşmezse el sıkışma reddedilir — erişim kodu araya giren
// bir cihaza gönderilmez. Eski TLSInsecure bayrağı doğrulamayı tamamen kapatır.
func Snapshot(c Config) (printflow.Telemetry, string, error) {
	if c.Host == "" || c.Serial == "" || c.AccessCode == "" {
		return printflow.Telemetry{}, "", fmt.Errorf("bambu: host, serial ve access code gerekli")
	}
	tlsName := c.TLSServerName
	if tlsName == "" {
		tlsName = c.Serial
	}
	var mu sync.Mutex
	var payload []byte
	var observed string
	topic := fmt.Sprintf("device/%s/report", c.Serial)

	opts := mqtt.NewClientOptions().
		AddBroker(fmt.Sprintf("ssl://%s:8883", c.Host)).
		SetUsername("bblp").
		SetPassword(c.AccessCode).
		SetConnectTimeout(10 * time.Second).
		SetAutoReconnect(false).
		SetConnectRetry(false).
		SetClientID(fmt.Sprintf("printflow-bridge-%d", time.Now().UnixNano()))

	tlsCfg := &tls.Config{ServerName: tlsName, InsecureSkipVerify: true, MinVersion: tls.VersionTLS12}
	if !c.TLSInsecure {
		tlsCfg.VerifyPeerCertificate = func(raw [][]byte, _ [][]*x509.Certificate) error {
			if len(raw) == 0 {
				return fmt.Errorf("Bambu TLS sertifikası yok")
			}
			fp := FingerprintSHA256(raw[0])
			mu.Lock()
			observed = fp
			mu.Unlock()
			if cert, err := x509.ParseCertificate(raw[0]); err == nil {
				cn := cert.Subject.CommonName
				if serialLike.MatchString(cn) && cn != c.Serial {
					return fmt.Errorf("bu IP'deki Bambu yazıcı farklı (%s); IP değişmiş olabilir", cn)
				}
			}
			if c.CertSHA256 != "" && !strings.EqualFold(c.CertSHA256, fp) {
				return fmt.Errorf("Bambu TLS sertifikası değişti — ağda araya giren cihaz olabilir; yazıcıyı yeniden eşleştirin")
			}
			return nil
		}
	}
	opts.SetTLSConfig(tlsCfg)

	got := make(chan struct{}, 1)
	opts.SetDefaultPublishHandler(func(_ mqtt.Client, msg mqtt.Message) {
		if msg.Topic() == topic || strings.HasSuffix(msg.Topic(), "/report") {
			mu.Lock()
			payload = append([]byte(nil), msg.Payload()...)
			mu.Unlock()
			select {
			case got <- struct{}{}:
			default:
			}
		}
	})

	fail := func(err error) (printflow.Telemetry, string, error) {
		mu.Lock()
		defer mu.Unlock()
		return printflow.Telemetry{}, observed, errors.New(ErrorMessage(err))
	}

	client := mqtt.NewClient(opts)
	token := client.Connect()
	if !token.WaitTimeout(12 * time.Second) {
		return fail(fmt.Errorf("mqtt timeout"))
	}
	if token.Error() != nil {
		return fail(token.Error())
	}
	sub := client.Subscribe(topic, 0, nil)
	if !sub.WaitTimeout(5*time.Second) || sub.Error() != nil {
		client.Disconnect(250)
		return fail(fmt.Errorf("mqtt subscribe: %v", sub.Error()))
	}
	// P1/A1 serisi boşta yalnızca değişiklik yayınlar; tam rapor iste.
	client.Publish(fmt.Sprintf("device/%s/request", c.Serial), 0, false,
		fmt.Sprintf(`{"pushing":{"sequence_id":"%d","command":"pushall"}}`, time.Now().UnixMilli()))
	select {
	case <-got:
	case <-time.After(8 * time.Second):
	}
	client.Disconnect(250)
	mu.Lock()
	defer mu.Unlock()
	if payload == nil {
		return printflow.Telemetry{}, observed, fmt.Errorf("Bambu: rapor alınamadı (bağlantı var, yazıcı mesaj göndermedi)")
	}
	tel, err := mapReport(payload, c.Serial)
	return tel, observed, err
}

func mapReport(raw []byte, serial string) (printflow.Telemetry, error) {
	var doc map[string]interface{}
	if err := json.Unmarshal(raw, &doc); err != nil {
		return printflow.Telemetry{}, err
	}
	print := nested(doc, "print")
	state := strings.ToLower(firstOf(print, "gcode_state", "mc_print_stage", "stg_cur"))
	if state == "" {
		state = strings.ToLower(firstOf(doc, "gcode_state", "print_status"))
	}
	printerState := "unknown"
	switch {
	case strings.Contains(state, "print") || state == "running":
		printerState = "printing"
	case strings.Contains(state, "pause"):
		printerState = "paused"
	case strings.Contains(state, "fail") || strings.Contains(state, "error"):
		printerState = "error"
	case state == "idle" || state == "finish" || state == "finished" || state == "completed":
		printerState = "idle"
	default:
		printerState = "idle"
	}
	var progress *float64
	if p := numberOf(print, "mc_percent", "print_progress"); p != nil {
		progress = p
	} else if p := numberOf(doc, "mc_percent"); p != nil {
		progress = p
	}
	job := firstOf(print, "subtask_name", "gcode_file")
	if job == "" {
		job = firstOf(doc, "subtask_name", "gcode_file")
	}
	var jobPtr *string
	if job != "" && (printerState == "printing" || printerState == "paused") {
		jobPtr = &job
	}
	if printerState != "printing" && printerState != "paused" {
		progress = nil
	}
	return printflow.Telemetry{
		ConnectionStatus: "connected",
		PrinterState:     printerState,
		JobName:          jobPtr,
		ProgressPercent:  progress,
		PrintTimeSeconds: nil,
		ErrorMessage:     nil,
		BedTempC:         numberOf(print, "bed_temper"),
		NozzleTempC:      numberOf(print, "nozzle_temper"),
		ChamberTempC:     numberOf(print, "chamber_temper"),
		Raw: map[string]interface{}{
			"vendor": "bambu",
			"serial": serial,
			"report": doc,
		},
	}, nil
}

func nested(doc map[string]interface{}, key string) map[string]interface{} {
	if v, ok := doc[key].(map[string]interface{}); ok {
		return v
	}
	return doc
}

func firstOf(m map[string]interface{}, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k]; ok {
			switch x := v.(type) {
			case string:
				return x
			case float64:
				return fmt.Sprintf("%.0f", x)
			}
		}
	}
	return ""
}

func numberOf(m map[string]interface{}, keys ...string) *float64 {
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
	return nil
}
