package lanapi

import (
	"crypto/md5"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"

	"github.com/printflow/printflow-bridge/internal/printflow"
)

var digestParamRe = regexp.MustCompile(`(\w+)=("([^"]*)"|[^,\s]*)`)

// ParseDigestChallenge `WWW-Authenticate: Digest realm=…` → parametreler (Digest değilse nil).
func ParseDigestChallenge(header string) map[string]string {
	if len(header) < 6 || !strings.EqualFold(header[:6], "digest") {
		return nil
	}
	out := map[string]string{}
	for _, m := range digestParamRe.FindAllStringSubmatch(header[6:], -1) {
		v := m[3]
		if v == "" {
			v = m[2]
		}
		out[strings.ToLower(m[1])] = v
	}
	return out
}

func md5hex(s string) string {
	sum := md5.Sum([]byte(s))
	return hex.EncodeToString(sum[:])
}

// DigestAuthorization RFC 2617 (MD5, qop=auth) Authorization başlığı.
func DigestAuthorization(username, password, method, uri string, ch map[string]string, nc int, cnonce string) string {
	if cnonce == "" {
		b := make([]byte, 8)
		_, _ = rand.Read(b)
		cnonce = hex.EncodeToString(b)
	}
	ha1 := md5hex(username + ":" + ch["realm"] + ":" + password)
	ha2 := md5hex(method + ":" + uri)
	qop := ""
	for _, q := range strings.Split(ch["qop"], ",") {
		if strings.TrimSpace(q) == "auth" {
			qop = "auth"
		}
	}
	ncHex := fmt.Sprintf("%08x", nc)
	var resp string
	if qop != "" {
		resp = md5hex(ha1 + ":" + ch["nonce"] + ":" + ncHex + ":" + cnonce + ":" + qop + ":" + ha2)
	} else {
		resp = md5hex(ha1 + ":" + ch["nonce"] + ":" + ha2)
	}
	parts := []string{
		fmt.Sprintf(`username="%s"`, username),
		fmt.Sprintf(`realm="%s"`, ch["realm"]),
		fmt.Sprintf(`nonce="%s"`, ch["nonce"]),
		fmt.Sprintf(`uri="%s"`, uri),
		fmt.Sprintf(`response="%s"`, resp),
	}
	if ch["opaque"] != "" {
		parts = append(parts, fmt.Sprintf(`opaque="%s"`, ch["opaque"]))
	}
	if qop != "" {
		parts = append(parts, "qop="+qop, "nc="+ncHex, fmt.Sprintf(`cnonce="%s"`, cnonce))
	}
	return "Digest " + strings.Join(parts, ", ")
}

func prusaGet(host string, port int, password, path string) (*response, error) {
	port = portOr(port, 80)
	res, err := do("GET", host, port, path, nil, nil)
	if err != nil {
		return nil, fmt.Errorf("PrusaLink: %w", err)
	}
	if res.Status == 401 && password != "" {
		if ch := ParseDigestChallenge(res.Header.Get("WWW-Authenticate")); ch != nil {
			res, err = do("GET", host, port, path, map[string]string{
				"Authorization": DigestAuthorization("maker", password, "GET", path, ch, 1, ""),
			}, nil)
			if err != nil {
				return nil, fmt.Errorf("PrusaLink: %w", err)
			}
		}
	}
	if res.Status == 401 {
		return nil, fmt.Errorf("PrusaLink şifresi hatalı (yazıcı ekranı → Ayarlar → Ağ → PrusaLink)")
	}
	return res, nil
}

// PrusaLinkInfo /api/v1/info → gerçek seri numarası (eşleştirme kimliği).
func PrusaLinkInfo(host string, port int, password string) (serial, hostname string, err error) {
	res, err := prusaGet(host, port, password, "/api/v1/info")
	if err != nil {
		return "", "", err
	}
	var doc map[string]any
	if res.Status == 200 && res.json(&doc) == nil {
		return str(doc["serial"]), str(doc["hostname"]), nil
	}
	legacy, err := prusaGet(host, port, password, "/api/version")
	if err != nil {
		return "", "", err
	}
	_ = legacy.json(&doc)
	return str(doc["serial"]), str(doc["hostname"]), nil
}

// PollPrusaLink /api/v1/status (+ /api/v1/job); eski firmware için /api/printer + /api/job.
func PollPrusaLink(host string, port int, password, serial string) (printflow.Telemetry, error) {
	st, err := prusaGet(host, port, password, "/api/v1/status")
	if err != nil {
		return printflow.Telemetry{}, err
	}
	var status map[string]any
	if st.Status == 200 && st.json(&status) == nil && status["printer"] != nil {
		job := ""
		if status["job"] != nil {
			if jr, err := prusaGet(host, port, password, "/api/v1/job"); err == nil {
				var jd map[string]any
				if jr.json(&jd) == nil {
					f := obj(jd, "file")
					job = str(f["display_name"])
					if job == "" {
						job = str(f["name"])
					}
				}
			}
		}
		return PrusaLinkTelemetry(serial, status, job), nil
	}
	legacy, err := prusaGet(host, port, password, "/api/printer")
	if err != nil {
		return printflow.Telemetry{}, err
	}
	var pd map[string]any
	if legacy.Status >= 300 || legacy.json(&pd) != nil {
		return printflow.Telemetry{}, fmt.Errorf("PrusaLink HTTP %d", legacy.Status)
	}
	var jd map[string]any
	if jr, err := prusaGet(host, port, password, "/api/job"); err == nil {
		_ = jr.json(&jd)
	}
	flags := obj(obj(pd, "state"), "flags")
	state := "idle"
	switch {
	case flags["paused"] == true:
		state = "paused"
	case flags["printing"] == true:
		state = "printing"
	case flags["error"] == true:
		state = "error"
	}
	temp := obj(pd, "temperature")
	file := obj(obj(jd, "job"), "file")
	name := str(file["display"])
	if name == "" {
		name = str(file["name"])
	}
	return build("prusalink", serial, telemetryIn{
		state:     state,
		job:       name,
		progress:  num(obj(jd, "progress")["completion"]),
		printTime: num(obj(jd, "progress")["printTime"]),
		bed:       num(obj(temp, "bed")["actual"]),
		nozzle:    num(obj(temp, "tool0")["actual"]),
		raw:       pd,
	}), nil
}

// PrusaLinkTelemetry /api/v1/status → telemetri.
func PrusaLinkTelemetry(serial string, status map[string]any, jobName string) printflow.Telemetry {
	p := obj(status, "printer")
	s := strings.ToUpper(str(p["state"]))
	state := "idle"
	errMsg := ""
	switch s {
	case "PRINTING":
		state = "printing"
	case "PAUSED":
		state = "paused"
	case "ERROR":
		state = "error"
	case "ATTENTION":
		state = "error"
		errMsg = "Yazıcı dikkat bekliyor (ekranı kontrol edin)"
	}
	job := obj(status, "job")
	return build("prusalink", serial, telemetryIn{
		state:     state,
		job:       jobName,
		progress:  num(job["progress"]),
		printTime: num(job["time_printing"]),
		bed:       num(p["temp_bed"]),
		nozzle:    num(p["temp_nozzle"]),
		errMsg:    errMsg,
		raw:       status,
	})
}
