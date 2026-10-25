import { networkInterfaces } from "node:os";
import net from "node:net";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";

/** Sanal / tünel arayüzleri: Docker, VPN, sanallaştırma köprüleri — yazıcı bulunmaz. */
const VIRTUAL_IFACE = /^(docker|br-|veth|virbr|vmnet|vboxnet|utun|tun|tap|wg|tailscale|zt|ham|llw|awdl|anpi|bridge\d|gif|stf|ipsec|ppp|lxc|lxd|cni|flannel|cali|vEthernet|VirtualBox|VMware|Hyper-V)/i;

export function ipToInt(ip) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

export function intToIp(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export function isPrivateIPv4(ip) {
  const n = ipToInt(ip);
  if (n == null) return false;
  const a = n >>> 24;
  const b = (n >>> 16) & 255;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function isLinkLocal(ip) {
  return ip.startsWith("169.254.");
}

export function isVirtualInterface(name) {
  return VIRTUAL_IFACE.test(name);
}

function prefixFromNetmask(mask) {
  const n = ipToInt(mask);
  if (n == null) return 24;
  let bits = 0;
  for (let i = 31; i >= 0; i--) {
    if ((n >>> i) & 1) bits++;
    else break;
  }
  return bits;
}

/**
 * Taranacak LAN arayüzleri. `ifaces` = os.networkInterfaces() çıktısı (test için enjekte edilebilir).
 * Geniş ağlar (/16 vb.) cihazın kendi /24'üne daraltılır — tarama süresi sınırlı kalır.
 */
export function listScanInterfaces(ifaces = networkInterfaces()) {
  const out = [];
  const seen = new Set();
  for (const [name, addrs] of Object.entries(ifaces ?? {})) {
    if (isVirtualInterface(name)) continue;
    for (const a of addrs ?? []) {
      const family = typeof a.family === "number" ? `IPv${a.family}` : a.family;
      if (family !== "IPv4" || a.internal) continue;
      if (isLinkLocal(a.address) || !isPrivateIPv4(a.address)) continue;
      const prefix = Math.max(prefixFromNetmask(a.netmask), 24);
      const ipN = ipToInt(a.address);
      const maskN = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
      const network = (ipN & maskN) >>> 0;
      const broadcast = (network | (~maskN >>> 0)) >>> 0;
      const cidr = `${intToIp(network)}/${prefix}`;
      if (seen.has(cidr)) continue;
      seen.add(cidr);
      out.push({
        name,
        address: a.address,
        netmask: a.netmask,
        prefix,
        cidr,
        broadcast: intToIp(broadcast),
        mac: a.mac && a.mac !== "00:00:00:00:00:00" ? a.mac.toLowerCase() : null,
      });
    }
  }
  return out;
}

/** CIDR içindeki kullanılabilir host adresleri (en fazla /24 = 254 adres). */
export function hostsInCidr(cidr, { exclude = [] } = {}) {
  const [base, prefixStr] = cidr.split("/");
  const prefix = Math.max(Number(prefixStr), 24);
  const baseN = ipToInt(base);
  if (baseN == null || prefix > 30) return [];
  const maskN = (0xffffffff << (32 - prefix)) >>> 0;
  const network = (baseN & maskN) >>> 0;
  const size = 2 ** (32 - prefix);
  const skip = new Set(exclude);
  const out = [];
  for (let i = 1; i < size - 1; i++) {
    const ip = intToIp(network + i);
    if (!skip.has(ip)) out.push(ip);
  }
  return out;
}

export function normalizeMac(mac) {
  if (!mac) return null;
  const hex = String(mac).toLowerCase().replace(/[^0-9a-f]/g, "");
  if (hex.length !== 12 || /^0+$/.test(hex) || /^f+$/.test(hex)) return null;
  return hex.match(/../g).join(":");
}

/** `arp -an` / /proc/net/arp çıktısından IP → MAC. */
export function parseArpTable(text) {
  const map = new Map();
  for (const line of String(text).split(/\r?\n/)) {
    const ip = line.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
    const mac = line.match(/([0-9a-f]{1,2}(?:[:-][0-9a-f]{1,2}){5})/i);
    if (!ip || !mac) continue;
    const m = normalizeMac(
      mac[1]
        .split(/[:-]/)
        .map((x) => x.padStart(2, "0"))
        .join(":")
    );
    if (m) map.set(ip[1], m);
  }
  return map;
}

/** ARP tablosu (best-effort; yoksa boş). Keşif sonrası çağrılır — yazıcılarla trafik olduğu için dolu olur. */
export async function readArpTable() {
  try {
    if (process.platform === "linux") {
      return parseArpTable(await readFile("/proc/net/arp", "utf8"));
    }
    // -n: ters DNS yok (yoksa her satır saniyeler sürebilir); Windows'ta -a zaten sayısal.
    const argv = process.platform === "win32" ? ["-a"] : ["-an"];
    const text = await new Promise((resolve) => {
      execFile("arp", argv, { timeout: 3000, windowsHide: true }, (err, stdout) =>
        resolve(err ? "" : String(stdout))
      );
    });
    return parseArpTable(text);
  } catch {
    return new Map();
  }
}

/** TCP port açık mı (kısa zaman aşımı). */
export function tcpOpen(host, port, timeoutMs = 450) {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port });
    const done = (ok) => {
      sock.removeAllListeners();
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(timeoutMs, () => done(false));
    sock.once("connect", () => done(true));
    sock.once("error", () => done(false));
  });
}

/** Eşzamanlılık sınırlı map. */
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}
