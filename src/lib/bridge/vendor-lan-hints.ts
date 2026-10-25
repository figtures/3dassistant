import type { BridgeVendor } from "./vendors";

/**
 * Müşteri paneli: köprü yazıcıları kendisi bulur. Burada yalnızca keşif yöntemi ve
 * kullanıcıdan bir kez istenebilecek yerel bilgi (varsa) yer alır.
 */
export const BRIDGE_LAN_HINTS: Record<
  BridgeVendor,
  { discovery: string; defaultPort: number; userInput: string | null }
> = {
  bambu: {
    discovery: "SSDP (UDP 2021) + TLS 8883",
    defaultPort: 8883,
    userInput:
      "Erişim kodu bir kez sorulur (yazıcı ekranı → Ayarlar → Ağ/WLAN → Access Code); Bambu Studio/OrcaSlicer’da kayıtlıysa oradan alınır. Kod girmek istemiyorsanız Makineler → “Yazıcıları bağla” ile Bambu hesabınızı bağlayın (Ücretsiz/Starter dışı planlar): telemetri buluttan gelir, köprü gerekmez.",
  },
  creality: { discovery: "mDNS + WebSocket 9999", defaultPort: 9999, userInput: null },
  anycubic: { discovery: "Port taraması (WS 6000)", defaultPort: 6000, userInput: null },
  elegoo: { discovery: "SDCP yayını (UDP 3000)", defaultPort: 3030, userInput: null },
  flashforge: { discovery: "UDP yayını + TCP 8899", defaultPort: 8899, userInput: null },
  snapmaker: { discovery: "UDP yayını (20054)", defaultPort: 8080, userInput: null },
  klipper: {
    discovery: "mDNS + Moonraker 7125",
    defaultPort: 7125,
    userInput: "Moonraker yetki istiyorsa API anahtarı sorulur.",
  },
  octoprint: {
    discovery: "mDNS + HTTP",
    defaultPort: 80,
    userInput: "OctoPrint arayüzünde köprünün erişim isteğini onaylamanız yeterli.",
  },
  prusalink: {
    discovery: "mDNS + HTTP",
    defaultPort: 80,
    userInput: "PrusaLink şifresi bir kez sorulur (yazıcı ekranı → Ayarlar → Ağ).",
  },
};
