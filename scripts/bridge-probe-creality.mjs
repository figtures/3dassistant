#!/usr/bin/env node
/**
 * (2) Creality LAN teşhis — atölyede çalıştırın.
 * CREALITY_HOST=192.168.1.50 node scripts/bridge-probe-creality.mjs
 */

const host = process.env.CREALITY_HOST?.trim();
const wsPort = Number(process.env.CREALITY_PORT || 9999);
if (!host) {
  console.error("CREALITY_HOST gerekli");
  process.exit(1);
}

async function tryHttp() {
  const paths = ["/api/print/snapshot", "/cgi-bin/get_dev_state"];
  for (const path of paths) {
    try {
      const res = await fetch(`http://${host}${path}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      return { path, body: await res.json() };
    } catch {
      /* next */
    }
  }
  return null;
}

async function tryWs() {
  const WebSocket = globalThis.WebSocket;
  if (!WebSocket) return null;
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://${host}:${wsPort}/`);
    const timer = setTimeout(() => {
      ws.close();
      resolve(null);
    }, 6000);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ mode: "subscribe", topic: "print" }));
      ws.send(JSON.stringify({ mode: "subscribe", topic: "status" }));
    });
    ws.addEventListener("message", (ev) => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(String(ev.data)));
      } catch {
        resolve({ raw: String(ev.data) });
      }
      ws.close();
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

const httpSnap = await tryHttp();
const wsSnap = await tryWs();

console.log(JSON.stringify({ host, wsPort, http: httpSnap, websocket: wsSnap }, null, 2));
if (!httpSnap && !wsSnap) {
  console.error("LAN yanıt yok — IP, LAN modu ve firewall kontrol edin.");
  process.exit(2);
}
