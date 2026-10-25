// PrintFlow Bridge — tek masaüstü ajanı (Bambu, Creality, Elegoo, Flashforge, Anycubic, Snapmaker,
// Klipper/Moonraker, OctoPrint, PrusaLink LAN → bulut). Tarayıcıdan bağımsız; printflow:// eşleştirme protokolü.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/printflow/printflow-bridge/internal/agent"
	"github.com/printflow/printflow-bridge/internal/config"
	"github.com/printflow/printflow-bridge/internal/discovery"
	"github.com/printflow/printflow-bridge/internal/pairing"
	"github.com/printflow/printflow-bridge/internal/printflow"
	"github.com/printflow/printflow-bridge/internal/support"
)

var agentVersion = "printflow-bridge/0.2.0"

func main() {
	log.SetFlags(0)
	if len(os.Args) < 2 {
		usage()
		return
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	switch os.Args[1] {
	case "version":
		fmt.Println(agentVersion)
	case "discover":
		runDiscover(ctx, os.Args[2:])
	case "pair":
		runPair(ctx, os.Args[2:])
	case "run":
		runAgent()
	case "open-url":
		if len(os.Args) < 3 {
			log.Fatal("open-url: printflow://pair?code=...&url=... gerekli")
		}
		runPair(ctx, append([]string{"--deep-link", os.Args[2]}, os.Args[3:]...))
	case "config-path":
		fmt.Println(config.DefaultConfigPath())
	case "support":
		runSupport(ctx, os.Args[2:])
	default:
		if strings.HasPrefix(os.Args[1], "printflow://") {
			runPair(ctx, append([]string{"--deep-link", os.Args[1]}, os.Args[2:]...))
			return
		}
		usage()
	}
}

func usage() {
	fmt.Fprintf(os.Stderr, `PrintFlow Bridge %s

  printflow-bridge pair --url URL --code KOD     Yazıcıları yerel ağda bulur, seçtirir ve eşleştirir
  printflow-bridge open-url printflow://pair?code=...&url=...
  printflow-bridge discover [--json] [--host IP] [--scan auto|always|never] [--timeout 6s]
  printflow-bridge run                           Arka planda telemetri gönderir
  printflow-bridge config-path
  printflow-bridge support [--json] [--upload]

pair seçenekleri:
  --select 1,3       Etkileşimsiz seçim (keşif listesindeki numaralar)
  --all              Desteklenen tüm yeni yazıcıları eşleştir
  --yes              Soru sorma (tek uygun yazıcı varsa otomatik; yoksa çıkış kodu 3)
  --json             Sonucu stdout'a JSON yaz (etkileşimsiz)
  --host IP          Farklı alt ağ / misafir ağı için IP (keşif yerine doğrudan yoklama)
  --vendor V         Listeyi markaya göre süz (bambu, creality, elegoo, flashforge, anycubic,
                     snapmaker, klipper, octoprint, prusalink)
  --access-code K    Bambu LAN erişim kodu        --password P   PrusaLink şifresi
  --api-key K        OctoPrint / Moonraker anahtarı
  --use-slicer-codes / --no-slicer-codes   Bambu Studio / OrcaSlicer'daki kodu sormadan kullan / hiç okuma
  --bambu-token T    Bambu hesap jetonu (veya BAMBU_CLOUD_TOKEN): erişim kodu yalnızca bu bilgisayardan
                     Bambu API'sinden alınır, PrintFlow'a gönderilmez   --bambu-region global|cn
  --use-slicer-token / --no-slicer-token   Bambu Studio oturumunu sormadan kullan / hiç bakma
  --no-cloud-codes   Bambu hesabından kod alma

Eski kullanım (geriye uyumlu): --host IP --serial SN [--vendor] [--access-code] veya
PRINTFLOW_URL, PAIRING_CODE, PRINTER_HOST, PRINTER_SERIAL ortam değişkenleri.

Yapılandırma: %s
`, agentVersion, config.DefaultConfigPath())
}

func runDiscover(ctx context.Context, args []string) {
	fs := flag.NewFlagSet("discover", flag.ExitOnError)
	asJSON := fs.Bool("json", false, "JSON çıktı (stdout)")
	host := fs.String("host", "", "Yalnızca bu IP'leri yokla (virgülle)")
	scan := fs.String("scan", "auto", "Port taraması: auto | always | never")
	timeout := fs.Duration("timeout", 6*time.Second, "Yayın dinleme süresi")
	noSlicer := fs.Bool("no-slicer-codes", false, "Dilimleyici erişim kodlarını okuma")
	cloudOpts := cloudFlags(fs)
	_ = fs.Parse(args)

	cfg, _ := config.Load()
	opts := discovery.Options{Timeout: *timeout, Scan: *scan}
	if cfg != nil {
		opts.Paired = cfg.Printers
	}
	if *host != "" {
		for _, h := range strings.Split(*host, ",") {
			if h = strings.TrimSpace(h); h != "" {
				opts.Hosts = append(opts.Hosts, h)
			}
		}
	}
	if !*noSlicer {
		opts.SlicerCodes, _ = discovery.ReadSlicerAccessCodes()
	}
	if !*asJSON {
		opts.Progress = func(m string) { fmt.Fprintf(os.Stderr, "  %s\n", m) }
		fmt.Fprintln(os.Stderr, "Yerel ağda yazıcılar aranıyor…")
	}
	res := discovery.Discover(ctx, opts)
	co := cloudOpts()
	if *noSlicer {
		co.SlicerToken = "no"
	}
	discovery.ApplyBambuCloud(ctx, &res, co)
	if *asJSON {
		b, _ := json.MarshalIndent(res, "", "  ")
		fmt.Println(string(b))
		return
	}
	for _, w := range res.Warnings {
		fmt.Fprintf(os.Stderr, "! %s\n", w)
	}
	pairing.PrintTable(os.Stderr, res.Printers)
	fmt.Fprintf(os.Stderr, "(%d yazıcı, %d ms)\n", len(res.Printers), res.DurationMs)
}

func runPair(ctx context.Context, args []string) {
	fs := flag.NewFlagSet("pair", flag.ExitOnError)
	deepLink := fs.String("deep-link", "", "printflow://pair?code=...&url=...")
	url := fs.String("url", "", "PrintFlow site kökü")
	code := fs.String("code", "", "6 haneli kod")
	vendor := fs.String("vendor", "", "Markaya göre süz (eski akışta varsayılan bambu)")
	serial := fs.String("serial", "", "Yazıcı seri / device id (eski akış)")
	host := fs.String("host", "", "Yazıcı LAN IP")
	label := fs.String("label", "", "Görünen ad")
	name := fs.String("name", "", "ERP makine adı")
	accessCode := fs.String("access-code", "", "Bambu LAN access code")
	password := fs.String("password", "", "PrusaLink şifresi")
	apiKey := fs.String("api-key", "", "OctoPrint / Moonraker API anahtarı")
	tlsInsecure := fs.Bool("bambu-tls-insecure", false, "Bambu TLS doğrulamayı tamamen kapat (önerilmez)")
	lanPort := fs.Int("lan-port", 0, "Yerel API portu (0 = marka varsayılanı)")
	sel := fs.String("select", "", "Etkileşimsiz seçim: 1,3")
	all := fs.Bool("all", false, "Desteklenen tüm yeni yazıcılar")
	yes := fs.Bool("yes", false, "Soru sorma")
	asJSON := fs.Bool("json", false, "Sonucu JSON yaz")
	useSlicer := fs.Bool("use-slicer-codes", false, "Dilimleyicideki Bambu kodunu sormadan kullan")
	noSlicer := fs.Bool("no-slicer-codes", false, "Dilimleyici kodlarını okuma")
	scan := fs.String("scan", "auto", "Port taraması: auto | always | never")
	timeout := fs.Duration("timeout", 6*time.Second, "Yayın dinleme süresi")
	cloudOpts := cloudFlags(fs)
	_ = fs.Parse(args)

	o := pairing.Options{
		Cloud: cloudOpts(),
		URL: *url, Code: *code, Vendor: *vendor, Serial: *serial, Host: *host, Label: *label, Name: *name,
		AccessCode: *accessCode, Password: *password, APIKey: *apiKey, TLSInsecure: *tlsInsecure, LanPort: *lanPort,
		Select: *sel, All: *all, Yes: *yes, JSON: *asJSON, Scan: *scan, Timeout: *timeout,
		SlicerCodes: "ask", AgentVersion: agentVersion, Interactive: pairing.IsTerminal(os.Stdin),
	}
	if *useSlicer {
		o.SlicerCodes = "use"
	}
	if *noSlicer {
		o.SlicerCodes = "no"
		o.Cloud.SlicerToken = "no"
	}
	envDefault(&o.URL, "PRINTFLOW_URL")
	envDefault(&o.Code, "PAIRING_CODE")
	envDefault(&o.Host, "PRINTER_HOST")
	envDefault(&o.Serial, "PRINTER_SERIAL")

	var err error
	if *deepLink != "" {
		err = agent.HandleDeepLink(ctx, *deepLink, o)
	} else {
		err = pairing.Run(ctx, o)
	}
	if err != nil {
		var pe *printflow.PairError
		switch {
		case errors.Is(err, pairing.ErrNeedsInteraction):
			fmt.Fprintln(os.Stderr, err)
			os.Exit(3)
		case errors.As(err, &pe):
			fmt.Fprintln(os.Stderr, pe.Message)
			os.Exit(1)
		default:
			log.Fatal(err)
		}
	}
	fmt.Fprintln(os.Stderr, "Yapılandırma:", config.DefaultConfigPath())
}

// cloudFlags Bambu hesabından yerel erişim kodu alma bayrakları (discover + pair).
func cloudFlags(fs *flag.FlagSet) func() discovery.CloudOptions {
	token := fs.String("bambu-token", "", "Bambu hesap jetonu (yalnızca yerelde, kod almak için; veya BAMBU_CLOUD_TOKEN)")
	region := fs.String("bambu-region", "global", "Bambu bulut bölgesi: global | cn")
	useSlicerToken := fs.Bool("use-slicer-token", false, "Bambu Studio / OrcaSlicer oturumunu sormadan kullan")
	noSlicerToken := fs.Bool("no-slicer-token", false, "Dilimleyici oturumuna hiç bakma")
	noCloud := fs.Bool("no-cloud-codes", false, "Bambu hesabından erişim kodu alma")
	return func() discovery.CloudOptions {
		o := discovery.CloudOptions{Token: *token, Region: *region, SlicerToken: "ask", Disabled: *noCloud}
		envDefault(&o.Token, "BAMBU_CLOUD_TOKEN")
		if *useSlicerToken {
			o.SlicerToken = "use"
		}
		if *noSlicerToken {
			o.SlicerToken = "no"
		}
		return o
	}
}

func envDefault(v *string, key string) {
	if *v == "" {
		*v = os.Getenv(key)
	}
}

func runSupport(ctx context.Context, args []string) {
	fs := flag.NewFlagSet("support", flag.ExitOnError)
	asJSON := fs.Bool("json", false, "JSON çıktı")
	doUpload := fs.Bool("upload", false, "Buluta yükle")
	_ = fs.Parse(args)

	bundle, err := support.BuildBundle(ctx, agentVersion)
	if err != nil {
		log.Fatal(err)
	}
	cfg, _ := config.Load()

	if *doUpload {
		result, err := support.UploadBundle(cfg, bundle)
		if err != nil {
			log.Fatal(err)
		}
		if *asJSON {
			enc, _ := json.MarshalIndent(map[string]interface{}{"bundle": bundle, "upload": result}, "", "  ")
			fmt.Println(string(enc))
		} else {
			fmt.Fprintf(os.Stderr, "Tanılama paketi yüklendi: %v\n", result["bundleCode"])
		}
		return
	}

	if *asJSON {
		enc, _ := json.MarshalIndent(bundle, "", "  ")
		fmt.Println(string(enc))
	} else {
		fmt.Fprintln(os.Stderr, "PrintFlow köprü tanılama paketi (gizli alanlar maskelenmiş)")
		enc, _ := json.MarshalIndent(bundle, "", "  ")
		fmt.Println(string(enc))
	}
}

func runAgent() {
	cfg, err := config.Load()
	if err != nil || cfg == nil || cfg.BridgeToken == "" {
		log.Fatal("Önce pair ile eşleştirin (printflow-bridge pair --url URL --code KOD).")
	}
	client := printflow.NewClient(cfg.PrintflowURL, cfg.BridgeToken)
	a := agent.New(client, cfg, agentVersion)
	log.Printf("PrintFlow Bridge çalışıyor (%d yazıcı)", len(cfg.Printers))
	for {
		if err := a.Tick(); err != nil {
			log.Printf("tick: %v", err)
		}
		time.Sleep(5 * time.Second)
	}
}
