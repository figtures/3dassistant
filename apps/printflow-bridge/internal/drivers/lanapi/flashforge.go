package lanapi

import (
	"bufio"
	"fmt"
	"net"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/printflow/printflow-bridge/internal/printflow"
)

var (
	ffMachineStatus = regexp.MustCompile(`(?i)MachineStatus:\s*(\S+)`)
	ffCurrentFile   = regexp.MustCompile(`(?i)CurrentFile:\s*([^\r\n]*)`)
	ffBytes         = regexp.MustCompile(`(?i)byte\s+(\d+)\s*/\s*(\d+)`)
	ffNozzle        = regexp.MustCompile(`(?i)T0:\s*([\d.]+)`)
	ffBed           = regexp.MustCompile(`(?i)B:\s*([\d.]+)`)
	ffOK            = regexp.MustCompile(`(?i)\bok\b`)
)

// FlashforgeStatus ~M119 / ~M27 / ~M105 yanıtlarından çıkarılan durum.
type FlashforgeStatus struct {
	State         string
	File          string
	Progress      *float64
	Nozzle, Bed   *float64
	MachineStatus string
}

func submatch(re *regexp.Regexp, s string) string {
	if m := re.FindStringSubmatch(s); m != nil {
		return strings.TrimSpace(m[1])
	}
	return ""
}

// ParseFlashforgeStatus TCP 8899 G-code yanıtlarını ayrıştırır.
func ParseFlashforgeStatus(m119, m27, m105 string) FlashforgeStatus {
	ms := strings.ToUpper(submatch(ffMachineStatus, m119))
	s := FlashforgeStatus{State: "idle", MachineStatus: ms, File: submatch(ffCurrentFile, m119)}
	if ms == "PAUSED" {
		s.State = "paused"
	} else if strings.HasPrefix(ms, "BUILDING") && ms != "BUILDING_COMPLETED" {
		s.State = "printing"
	}
	if m := ffBytes.FindStringSubmatch(m27); m != nil {
		done, _ := strconv.ParseFloat(m[1], 64)
		total, _ := strconv.ParseFloat(m[2], 64)
		if total > 0 {
			v := done / total * 100
			s.Progress = &v
		}
	}
	s.Nozzle = num(submatch(ffNozzle, m105))
	s.Bed = num(submatch(ffBed, m105))
	return s
}

// PollFlashforgeTCP eski/yeni Flashforge modellerinde ortak TCP 8899 G-code arayüzü.
func PollFlashforgeTCP(host, serial string) (printflow.Telemetry, error) {
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, "8899"), 5*time.Second)
	if err != nil {
		return printflow.Telemetry{}, fmt.Errorf("Flashforge 8899: %w", err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(6 * time.Second))
	rd := bufio.NewReader(conn)
	replies := map[string]string{}
	for _, cmd := range []string{"~M601 S1", "~M119", "~M27", "~M105"} {
		if _, err := fmt.Fprintf(conn, "%s\r\n", cmd); err != nil {
			return printflow.Telemetry{}, err
		}
		var buf strings.Builder
		for !ffOK.MatchString(buf.String()) {
			line, err := rd.ReadString('\n')
			buf.WriteString(line)
			if err != nil {
				return printflow.Telemetry{}, fmt.Errorf("Flashforge zaman aşımı: %w", err)
			}
		}
		replies[strings.ToLower(strings.Fields(cmd[1:])[0])] = buf.String()
	}
	_, _ = fmt.Fprint(conn, "~M602\r\n")
	s := ParseFlashforgeStatus(replies["m119"], replies["m27"], replies["m105"])
	return build("flashforge", serial, telemetryIn{
		state:    s.State,
		job:      s.File,
		progress: s.Progress,
		bed:      s.Bed,
		nozzle:   s.Nozzle,
		raw:      map[string]any{"machineStatus": s.MachineStatus},
	}), nil
}
