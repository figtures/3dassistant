package discovery

import (
	"context"
	"net"
	"strconv"
	"sync"
	"syscall"
	"time"
)

// listenUDP4 UDP soketi açar. reuse=true: SO_REUSEADDR (BSD/macOS'ta ayrıca SO_REUSEPORT) —
// Bambu Studio aynı portu dinliyorsa yayınlar her iki uygulamaya da ulaşır.
func listenUDP4(ip net.IP, port int, reuse bool) (*net.UDPConn, error) {
	lc := net.ListenConfig{}
	if reuse {
		lc.Control = func(_, _ string, c syscall.RawConn) error {
			return c.Control(func(fd uintptr) { setReuse(fd) })
		}
	}
	host := ""
	if ip != nil {
		host = ip.String()
	}
	pc, err := lc.ListenPacket(context.Background(), "udp4", net.JoinHostPort(host, strconv.Itoa(port)))
	if err != nil {
		return nil, err
	}
	return pc.(*net.UDPConn), nil
}

// setMulticastInterface çoklu yayın çıkış arayüzü + TTL 255 (best-effort).
func setMulticastInterface(conn *net.UDPConn, ip net.IP) {
	ip4 := ip.To4()
	if ip4 == nil {
		return
	}
	raw, err := conn.SyscallConn()
	if err != nil {
		return
	}
	_ = raw.Control(func(fd uintptr) { setMulticastOpts(fd, [4]byte{ip4[0], ip4[1], ip4[2], ip4[3]}) })
}

type udpTarget struct {
	Host string
	Port int
}

func (t udpTarget) addr() *net.UDPAddr {
	if ip := net.ParseIP(t.Host); ip != nil {
		return &net.UDPAddr{IP: ip, Port: t.Port}
	}
	a, err := net.ResolveUDPAddr("udp4", net.JoinHostPort(t.Host, strconv.Itoa(t.Port)))
	if err != nil {
		return nil
	}
	return a
}

// readLoop soket kapanana / süre dolana kadar paketleri handle'a verir; dönen fonksiyon bitişi bekler.
func readLoop(conn *net.UDPConn, deadline time.Time, handle func([]byte, *net.UDPAddr)) func() {
	_ = conn.SetReadDeadline(deadline)
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		buf := make([]byte, 65535)
		for {
			n, from, err := conn.ReadFromUDP(buf)
			if err != nil {
				return
			}
			pkt := append([]byte(nil), buf[:n]...)
			handle(pkt, from)
		}
	}()
	return wg.Wait
}

func sendAll(conn *net.UDPConn, payload []byte, targets []udpTarget) {
	for _, t := range targets {
		if a := t.addr(); a != nil {
			_, _ = conn.WriteToUDP(payload, a)
		}
	}
}

// udpQuery yayın/çoklu yayın sorgusu → yanıtları parse eder.
func udpQuery(ctx context.Context, payload []byte, targets []udpTarget, timeout time.Duration, parse func([]byte, string) *candidate) ([]candidate, error) {
	conn, err := listenUDP4(nil, 0, true)
	if err != nil {
		return nil, err
	}
	var mu sync.Mutex
	var out []candidate
	wait := readLoop(conn, time.Now().Add(timeout), func(b []byte, from *net.UDPAddr) {
		if c := parse(b, from.IP.String()); c != nil {
			mu.Lock()
			out = append(out, *c)
			mu.Unlock()
		}
	})
	sendAll(conn, payload, targets)
	second := min(700*time.Millisecond, timeout/3)
	sleepCtx(ctx, second)
	if ctx.Err() == nil {
		sendAll(conn, payload, targets)
		sleepCtx(ctx, timeout-second)
	}
	conn.Close()
	wait()
	return out, nil
}

func broadcastTargets(ifaces []Interface) []string {
	seen := map[string]bool{"255.255.255.255": true}
	out := []string{"255.255.255.255"}
	for _, i := range ifaces {
		if i.Broadcast != "" && !seen[i.Broadcast] {
			seen[i.Broadcast] = true
			out = append(out, i.Broadcast)
		}
	}
	return out
}
