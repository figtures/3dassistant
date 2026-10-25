package discovery

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Sanal / tünel arayüzleri: Docker, VPN, sanallaştırma köprüleri — yazıcı bulunmaz.
var virtualIface = regexp.MustCompile(`(?i)^(docker|br-|veth|virbr|vmnet|vboxnet|utun|tun|tap|wg|tailscale|zt|ham|llw|awdl|anpi|bridge\d|gif|stf|ipsec|ppp|lxc|lxd|cni|flannel|cali|vEthernet|VirtualBox|VMware|Hyper-V)`)

// Interface taranacak bir LAN arayüzü (/24'e daraltılmış).
type Interface struct {
	Name      string
	Address   string
	Netmask   string
	Prefix    int
	CIDR      string
	Broadcast string
	MAC       string
}

// InterfaceInfo JSON çıktısındaki arayüz özeti.
type InterfaceInfo struct {
	Name    string `json:"name"`
	Address string `json:"address"`
	CIDR    string `json:"cidr"`
}

// IfaceAddr bir arayüz adresi (IP + maske).
type IfaceAddr struct {
	IP   net.IP
	Mask net.IPMask
}

// RawInterface işletim sisteminden okunan arayüz (testte elle verilebilir).
type RawInterface struct {
	Name  string
	Flags net.Flags
	MAC   string
	Addrs []IfaceAddr
}

// SystemInterfaces işletim sisteminin ağ arayüzlerini okur.
func SystemInterfaces() []RawInterface {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	out := make([]RawInterface, 0, len(ifaces))
	for _, ifc := range ifaces {
		r := RawInterface{Name: ifc.Name, Flags: ifc.Flags, MAC: ifc.HardwareAddr.String()}
		addrs, _ := ifc.Addrs()
		for _, a := range addrs {
			if ipn, ok := a.(*net.IPNet); ok {
				r.Addrs = append(r.Addrs, IfaceAddr{IP: ipn.IP, Mask: ipn.Mask})
			}
		}
		out = append(out, r)
	}
	return out
}

func ipToInt(ip string) (uint32, bool) {
	parts := strings.Split(ip, ".")
	if len(parts) != 4 {
		return 0, false
	}
	var n uint32
	for _, p := range parts {
		v, err := strconv.Atoi(p)
		if err != nil || v < 0 || v > 255 {
			return 0, false
		}
		n = n<<8 | uint32(v)
	}
	return n, true
}

func intToIP(n uint32) string {
	return fmt.Sprintf("%d.%d.%d.%d", n>>24&255, n>>16&255, n>>8&255, n&255)
}

func isPrivateIPv4(ip string) bool {
	n, ok := ipToInt(ip)
	if !ok {
		return false
	}
	a := n >> 24
	b := (n >> 16) & 255
	return a == 10 || (a == 172 && b >= 16 && b <= 31) || (a == 192 && b == 168)
}

func isLinkLocal(ip string) bool { return strings.HasPrefix(ip, "169.254.") }

func isVirtualInterface(name string) bool { return virtualIface.MatchString(name) }

var ipv4Re = regexp.MustCompile(`^\d{1,3}(\.\d{1,3}){3}$`)

func isIPv4(s string) bool { return ipv4Re.MatchString(s) }

func prefixFromMask(mask net.IPMask) int {
	if len(mask) == 16 {
		mask = mask[12:]
	}
	if len(mask) != 4 {
		return 24
	}
	bits := 0
	for _, b := range mask {
		for i := 7; i >= 0; i-- {
			if b>>uint(i)&1 == 1 {
				bits++
			} else {
				return bits
			}
		}
	}
	return bits
}

// ListScanInterfaces taranacak LAN arayüzleri. Geniş ağlar (/16 vb.) cihazın kendi /24'üne
// daraltılır — tarama süresi sınırlı kalır.
func ListScanInterfaces(raw []RawInterface) []Interface {
	var out []Interface
	seen := map[string]bool{}
	for _, ifc := range raw {
		if isVirtualInterface(ifc.Name) || ifc.Flags&net.FlagLoopback != 0 || ifc.Flags&net.FlagUp == 0 {
			continue
		}
		for _, a := range ifc.Addrs {
			ip4 := a.IP.To4()
			if ip4 == nil || ip4.IsLoopback() {
				continue
			}
			addr := ip4.String()
			if isLinkLocal(addr) || !isPrivateIPv4(addr) {
				continue
			}
			prefix := max(prefixFromMask(a.Mask), 24)
			ipN, _ := ipToInt(addr)
			var maskN uint32
			if prefix > 0 {
				maskN = ^uint32(0) << (32 - prefix)
			}
			network := ipN & maskN
			broadcast := network | ^maskN
			cidr := fmt.Sprintf("%s/%d", intToIP(network), prefix)
			if seen[cidr] {
				continue
			}
			seen[cidr] = true
			mask := a.Mask
			if len(mask) == 16 {
				mask = mask[12:]
			}
			netmask := ""
			if len(mask) == 4 {
				netmask = net.IP(mask).String()
			}
			out = append(out, Interface{
				Name:      ifc.Name,
				Address:   addr,
				Netmask:   netmask,
				Prefix:    prefix,
				CIDR:      cidr,
				Broadcast: intToIP(broadcast),
				MAC:       normalizeMac(ifc.MAC),
			})
		}
	}
	return out
}

// hostsInCidr CIDR içindeki kullanılabilir host adresleri (en fazla /24 = 254 adres).
func hostsInCidr(cidr string, exclude []string) []string {
	base, prefixStr, ok := strings.Cut(cidr, "/")
	if !ok {
		return nil
	}
	p, err := strconv.Atoi(prefixStr)
	if err != nil {
		return nil
	}
	prefix := max(p, 24)
	baseN, ok := ipToInt(base)
	if !ok || prefix > 30 {
		return nil
	}
	maskN := ^uint32(0) << (32 - prefix)
	network := baseN & maskN
	size := uint32(1) << (32 - prefix)
	skip := map[string]bool{}
	for _, e := range exclude {
		skip[e] = true
	}
	var out []string
	for i := uint32(1); i < size-1; i++ {
		ip := intToIP(network + i)
		if !skip[ip] {
			out = append(out, ip)
		}
	}
	return out
}

var nonHex = regexp.MustCompile(`[^0-9a-f]`)

// normalizeMac MAC adresini aa:bb:cc:dd:ee:ff biçimine getirir; geçersizse "".
func normalizeMac(mac string) string {
	if mac == "" {
		return ""
	}
	hex := nonHex.ReplaceAllString(strings.ToLower(mac), "")
	if len(hex) != 12 || strings.Trim(hex, "0") == "" || strings.Trim(hex, "f") == "" {
		return ""
	}
	parts := make([]string, 6)
	for i := range 6 {
		parts[i] = hex[i*2 : i*2+2]
	}
	return strings.Join(parts, ":")
}

var (
	arpIPRe  = regexp.MustCompile(`(\d{1,3}(?:\.\d{1,3}){3})`)
	arpMacRe = regexp.MustCompile(`(?i)([0-9a-f]{1,2}(?:[:-][0-9a-f]{1,2}){5})`)
	macSepRe = regexp.MustCompile(`[:-]`)
)

// parseArpTable `arp -a` / /proc/net/arp çıktısından IP → MAC.
func parseArpTable(text string) map[string]string {
	out := map[string]string{}
	for _, line := range strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n") {
		ip := arpIPRe.FindStringSubmatch(line)
		mac := arpMacRe.FindStringSubmatch(line)
		if ip == nil || mac == nil {
			continue
		}
		parts := macSepRe.Split(mac[1], -1)
		for i, p := range parts {
			if len(p) == 1 {
				parts[i] = "0" + p
			}
		}
		if m := normalizeMac(strings.Join(parts, ":")); m != "" {
			out[ip[1]] = m
		}
	}
	return out
}

// readArpTable ARP tablosu (best-effort; yoksa boş).
func readArpTable(ctx context.Context) map[string]string {
	if runtime.GOOS == "linux" {
		b, err := os.ReadFile("/proc/net/arp")
		if err != nil {
			return map[string]string{}
		}
		return parseArpTable(string(b))
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	// -n: ters DNS yok (yoksa her satır saniyeler sürer, 3 sn sınırında tablo boş kalır).
	args := []string{"-an"}
	if runtime.GOOS == "windows" {
		args = []string{"-a"}
	}
	b, err := exec.CommandContext(ctx, "arp", args...).Output()
	if err != nil {
		return map[string]string{}
	}
	return parseArpTable(string(b))
}

// tcpOpen TCP port açık mı (kısa zaman aşımı).
func tcpOpen(ctx context.Context, host string, port int, timeout time.Duration) bool {
	d := net.Dialer{Timeout: timeout}
	c, err := d.DialContext(ctx, "tcp", net.JoinHostPort(host, strconv.Itoa(port)))
	if err != nil {
		return false
	}
	c.Close()
	return true
}

// mapLimit eşzamanlılık sınırlı map (sonuç sırası korunur).
func mapLimit[T, R any](items []T, limit int, fn func(T, int) R) []R {
	out := make([]R, len(items))
	if len(items) == 0 {
		return out
	}
	limit = max(1, min(limit, len(items)))
	var mu sync.Mutex
	next := 0
	var wg sync.WaitGroup
	for range limit {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				mu.Lock()
				i := next
				next++
				mu.Unlock()
				if i >= len(items) {
					return
				}
				out[i] = fn(items[i], i)
			}
		}()
	}
	wg.Wait()
	return out
}

func sleepCtx(ctx context.Context, d time.Duration) {
	if d <= 0 {
		return
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
	case <-t.C:
	}
}
