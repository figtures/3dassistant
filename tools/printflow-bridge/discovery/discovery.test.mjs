import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSsdpMessage, bambuCandidateFromSsdp } from "./ssdp.mjs";
import {
  encodeMdnsQuery,
  encodeMdnsResponse,
  decodeMdnsPacket,
  candidatesFromMdnsRecords,
  TYPE,
} from "./mdns.mjs";
import {
  parseSdcpResponse,
  parseSnapmakerResponse,
  parseFlashforgeM115,
  parseFlashforgeUdp,
} from "./udp-vendors.mjs";
import { listScanInterfaces, hostsInCidr, parseArpTable, normalizeMac } from "./net.mjs";
import { mergeCandidates, finalizeCandidates, pairingSerial, primaryCandidates, markAccessCodes } from "./merge.mjs";
import { extractAccessCodes, parseSlicerConf, slicerConfigPaths } from "./slicer-secrets.mjs";
import { accessCodesFromBind, fetchBambuAccessCodes, findTokenInDoc, readSlicerCloudToken } from "./bambu-cloud.mjs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crealityFromWsMessage } from "./probes.mjs";

const BAMBU_NOTIFY = [
  "NOTIFY * HTTP/1.1",
  "HOST: 239.255.255.250:1900",
  "Server: UPnP/1.0",
  "Location: 192.168.1.151",
  "NT: urn:bambulab-com:device:3dprinter:1",
  "USN: 01P00A123456789",
  "Cache-Control: max-age=1800",
  "DevModel.bambu.com: C12",
  "DevName.bambu.com: Atolye P1S",
  "DevSignal.bambu.com: -48",
  "DevConnect.bambu.com: lan",
  "DevBind.bambu.com: free",
  "",
  "",
].join("\r\n");

describe("SSDP (Bambu)", () => {
  it("parses headers case-insensitively", () => {
    const { startLine, headers } = parseSsdpMessage(BAMBU_NOTIFY);
    assert.equal(startLine, "NOTIFY * HTTP/1.1");
    assert.equal(headers["devmodel.bambu.com"], "C12");
    assert.equal(headers.usn, "01P00A123456789");
  });

  it("builds Bambu candidate with model mapping", () => {
    const c = bambuCandidateFromSsdp(BAMBU_NOTIFY, "192.168.1.99");
    assert.equal(c.vendor, "bambu");
    assert.equal(c.host, "192.168.1.151");
    assert.equal(c.serial, "01P00A123456789");
    assert.equal(c.model, "P1S");
    assert.equal(c.name, "Atolye P1S");
    assert.equal(c.extra.signalDbm, -48);
    assert.equal(c.extra.connectMode, "lan");
  });

  it("falls back to sender IP and keeps unknown model codes", () => {
    const msg = BAMBU_NOTIFY.replace("Location: 192.168.1.151", "Location: ").replace("C12", "ZX9");
    const c = bambuCandidateFromSsdp(msg, "10.0.0.5");
    assert.equal(c.host, "10.0.0.5");
    assert.equal(c.model, "ZX9");
  });

  it("maps X2D model code N6", () => {
    const c = bambuCandidateFromSsdp(BAMBU_NOTIFY.replace("C12", "N6").replace("lan", "cloud"), "192.168.1.151");
    assert.equal(c.model, "X2D");
    assert.equal(c.extra.modelCode, "N6");
    assert.equal(c.extra.connectMode, "cloud");
  });

  it("ignores non-Bambu SSDP traffic", () => {
    const msg = "NOTIFY * HTTP/1.1\r\nNT: upnp:rootdevice\r\nUSN: uuid:abc\r\nLocation: http://192.168.1.1:1900/x.xml\r\n\r\n";
    assert.equal(bambuCandidateFromSsdp(msg, "192.168.1.1"), null);
  });
});

describe("mDNS", () => {
  it("encodes a PTR query with QU bit", () => {
    const buf = encodeMdnsQuery(["_moonraker._tcp.local"], { id: 7 });
    assert.equal(buf.readUInt16BE(0), 7);
    assert.equal(buf.readUInt16BE(4), 1);
    const pkt = decodeMdnsPacket(buf);
    assert.equal(pkt.isResponse, false);
    assert.equal(pkt.questions[0].name, "_moonraker._tcp.local");
    assert.equal(pkt.questions[0].type, TYPE.PTR);
    // QU bit
    assert.equal(buf.readUInt16BE(buf.length - 2) & 0x8000, 0x8000);
  });

  it("round-trips PTR/SRV/TXT/A records", () => {
    const records = [
      { name: "_moonraker._tcp.local", type: TYPE.PTR, data: "Voron._moonraker._tcp.local" },
      { name: "Voron._moonraker._tcp.local", type: TYPE.SRV, data: { port: 7125, target: "voron.local" } },
      { name: "Voron._moonraker._tcp.local", type: TYPE.TXT, data: { serial: "ABC123", flag: true } },
      { name: "voron.local", type: TYPE.A, data: "192.168.1.40" },
    ];
    const pkt = decodeMdnsPacket(encodeMdnsResponse(records));
    assert.equal(pkt.isResponse, true);
    assert.equal(pkt.records.length, 4);
    assert.equal(pkt.records[0].data, "Voron._moonraker._tcp.local");
    assert.deepEqual(pkt.records[1].data, { priority: 0, weight: 0, port: 7125, target: "voron.local" });
    assert.deepEqual(pkt.records[2].data, { serial: "ABC123", flag: true });
    assert.equal(pkt.records[3].data, "192.168.1.40");

    const { candidates } = candidatesFromMdnsRecords(pkt.records, "192.168.1.200");
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].vendor, "klipper");
    assert.equal(candidates[0].host, "192.168.1.40");
    assert.equal(candidates[0].lanPort, 7125);
    assert.equal(candidates[0].serial, "ABC123");
  });

  it("decodes compressed names", () => {
    // Elle sıkıştırılmış: ikinci kayıt adı ilk adın ofsetine işaret eder.
    const base = encodeMdnsResponse([{ name: "_services._dns-sd._udp.local", type: TYPE.PTR, data: "_Creality-AB12CD34._udp.local" }]);
    const nameOffset = 12;
    const ptr = Buffer.from([0xc0, nameOffset]);
    const meta = Buffer.alloc(10);
    meta.writeUInt16BE(TYPE.A, 0);
    meta.writeUInt16BE(1, 2);
    meta.writeUInt32BE(60, 4);
    meta.writeUInt16BE(4, 8);
    const extra = Buffer.concat([ptr, meta, Buffer.from([192, 168, 1, 77])]);
    const buf = Buffer.concat([base, extra]);
    buf.writeUInt16BE(2, 6);
    const pkt = decodeMdnsPacket(buf);
    assert.equal(pkt.records[1].name, "_services._dns-sd._udp.local");
    assert.equal(pkt.records[1].data, "192.168.1.77");
    const { candidates } = candidatesFromMdnsRecords(pkt.records, "192.168.1.77");
    assert.equal(candidates[0].vendor, "creality");
    assert.equal(candidates[0].serial, "AB12CD34");
  });

  it("extracts Creality device id from service name; ignores its SRV port", () => {
    // Gerçek K2 Pro yanıtı: _services._dns-sd._udp.local PTR _Creality-2657712810F9A7._udp.local
    const records = [
      { name: "_services._dns-sd._udp.local", type: TYPE.PTR, data: "_Creality-2657712810F9A7._udp.local" },
      { name: "_Creality-2657712810F9A7._udp.local", type: TYPE.PTR, data: "K2Pro-F9A7._Creality-2657712810F9A7._udp.local" },
      { name: "K2Pro-F9A7._Creality-2657712810F9A7._udp.local", type: TYPE.SRV, data: { port: 5353, target: "K2Pro-F9A7.local" } },
    ];
    const { candidates } = candidatesFromMdnsRecords(records, "192.168.1.148");
    assert.ok(candidates.every((c) => c.vendor === "creality" && c.serial === "2657712810F9A7"));
    assert.ok(candidates.every((c) => c.lanPort == null));
    const merged = mergeCandidates([
      ...candidates,
      { vendor: "creality", host: "192.168.1.148", serial: "SN_XXX", model: "F012", name: "K2Pro-F9A7", lanPort: 9999, methods: ["ws-probe"], confidence: 0.85 },
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].serial, "2657712810F9A7");
    assert.equal(merged[0].lanPort, 9999);
  });

  it("rejects truncated / looping packets without crashing", () => {
    assert.throws(() => decodeMdnsPacket(Buffer.alloc(5)));
    const loop = Buffer.alloc(14);
    loop.writeUInt16BE(1, 4);
    loop[12] = 0xc0;
    loop[13] = 12;
    assert.throws(() => decodeMdnsPacket(loop));
  });

  it("classifies unsupported vendors (UltiMaker)", () => {
    const { candidates } = candidatesFromMdnsRecords(
      [{ name: "_ultimaker._tcp.local", type: TYPE.PTR, data: "S5._ultimaker._tcp.local" }],
      "192.168.1.9"
    );
    assert.equal(candidates[0].vendor, "ultimaker");
    const [p] = finalizeCandidates(mergeCandidates(candidates));
    assert.equal(p.supported, false);
  });
});

describe("UDP vendor responses", () => {
  it("parses Elegoo SDCP M99999 response", () => {
    const text = JSON.stringify({
      Id: "979d4C788A4a78bC777A870F1A02867A",
      Data: {
        Name: "Centauri Carbon",
        MachineName: "Centauri Carbon",
        BrandName: "ELEGOO",
        MainboardIP: "192.168.1.66",
        MainboardID: "ffffffff2a6c0f00",
        ProtocolVersion: "V3.0.0",
        FirmwareVersion: "V1.1.29",
      },
    });
    const c = parseSdcpResponse(text, "192.168.1.1");
    assert.equal(c.vendor, "elegoo");
    assert.equal(c.host, "192.168.1.66");
    assert.equal(c.serial, "ffffffff2a6c0f00");
    assert.equal(c.lanPort, 3030);
  });

  it("parses legacy SDCP Attributes nesting and rejects junk", () => {
    const c = parseSdcpResponse(
      JSON.stringify({ Data: { Attributes: { MainboardID: "abc", Name: "Saturn 3 Ultra" } } }),
      "192.168.1.50"
    );
    assert.equal(c.serial, "abc");
    assert.equal(c.host, "192.168.1.50");
    assert.equal(parseSdcpResponse("M99999", "1.2.3.4"), null);
    assert.equal(parseSdcpResponse("{}", "1.2.3.4"), null);
  });

  it("parses Snapmaker discover response", () => {
    const c = parseSnapmakerResponse("Snapmaker@192.168.1.31|model:Snapmaker 2 Model A350|status:IDLE|SACP:1", "192.168.1.31");
    assert.equal(c.vendor, "snapmaker");
    assert.equal(c.model, "Snapmaker 2 Model A350");
    assert.equal(c.extra.status, "IDLE");
    assert.equal(parseSnapmakerResponse("discover", "1.1.1.1"), null);
  });

  it("parses Flashforge M115 and UDP blobs", () => {
    const info = parseFlashforgeM115(
      "CMD M115 Received.\r\nMachine Type: Flashforge Adventurer 5M\r\nMachine Name: AD5M\r\nFirmware: v2.7.5\r\nSN: SNMOMC9900728\r\nX: 220 Y: 220 Z: 220\r\nTool Count: 1\r\nMac Address: 88:A9:A7:93:86:F8\r\nok\r\n"
    );
    assert.equal(info.serial, "SNMOMC9900728");
    assert.equal(info.machineType, "Flashforge Adventurer 5M");
    assert.equal(normalizeMac(info.mac), "88:a9:a7:93:86:f8");
    const blob = Buffer.concat([Buffer.from("AD5M Atolye"), Buffer.alloc(20), Buffer.from("SNMOMC9900728"), Buffer.alloc(8)]);
    const c = parseFlashforgeUdp(blob, "192.168.1.70");
    assert.equal(c.serial, "SNMOMC9900728");
    assert.equal(c.name, "AD5M Atolye");
    assert.equal(parseFlashforgeM115("hello"), null);
  });
});

describe("network enumeration", () => {
  const ifaces = {
    lo0: [{ address: "127.0.0.1", netmask: "255.0.0.0", family: "IPv4", internal: true }],
    en0: [
      { address: "192.168.1.20", netmask: "255.255.255.0", family: "IPv4", internal: false, mac: "AA:BB:CC:DD:EE:FF" },
      { address: "fe80::1", netmask: "ffff:ffff:ffff:ffff::", family: "IPv6", internal: false },
    ],
    en1: [{ address: "10.20.30.40", netmask: "255.255.0.0", family: "IPv4", internal: false }],
    docker0: [{ address: "172.17.0.1", netmask: "255.255.0.0", family: "IPv4", internal: false }],
    utun3: [{ address: "10.8.0.2", netmask: "255.255.255.0", family: "IPv4", internal: false }],
    en5: [{ address: "169.254.10.2", netmask: "255.255.0.0", family: "IPv4", internal: false }],
    eth9: [{ address: "203.0.113.5", netmask: "255.255.255.0", family: "IPv4", internal: false }],
    en7: [{ address: "192.168.1.21", netmask: "255.255.255.0", family: 4, internal: false }],
  };

  it("skips loopback, IPv6, docker/vpn, link-local, public; caps to /24; dedupes", () => {
    const list = listScanInterfaces(ifaces);
    assert.deepEqual(
      list.map((i) => i.cidr),
      ["192.168.1.0/24", "10.20.30.0/24"]
    );
    assert.equal(list[0].broadcast, "192.168.1.255");
    assert.equal(list[1].broadcast, "10.20.30.255");
  });

  it("enumerates hosts excluding own address", () => {
    const hosts = hostsInCidr("192.168.1.0/24", { exclude: ["192.168.1.20"] });
    assert.equal(hosts.length, 253);
    assert.equal(hosts[0], "192.168.1.1");
    assert.equal(hosts.at(-1), "192.168.1.254");
    assert.equal(hostsInCidr("10.0.0.0/16").length, 254);
  });

  it("parses arp tables (macOS, Linux, Windows)", () => {
    const mac = parseArpTable("? (192.168.1.151) at 0:e0:4c:68:1:2 on en0 ifscope [ethernet]");
    assert.equal(mac.get("192.168.1.151"), "00:e0:4c:68:01:02");
    const lin = parseArpTable("IP address HW type Flags HW address Mask Device\n192.168.1.40 0x1 0x2 b8:27:eb:12:34:56 * wlan0");
    assert.equal(lin.get("192.168.1.40"), "b8:27:eb:12:34:56");
    const win = parseArpTable("  192.168.1.66          88-a9-a7-93-86-f8     dynamic");
    assert.equal(win.get("192.168.1.66"), "88:a9:a7:93:86:f8");
    assert.equal(parseArpTable("? (192.168.1.9) at (incomplete) on en0").size, 0);
  });
});

describe("merge / dedupe", () => {
  it("merges same printer from SSDP + TLS probe and raises confidence", () => {
    const merged = mergeCandidates([
      { vendor: "bambu", host: "192.168.1.151", serial: "01P00A123456789", model: "P1S", methods: ["ssdp"], confidence: 0.95 },
      { vendor: "bambu", host: "192.168.1.151", serial: "01P00A123456789", methods: ["tls-probe"], confidence: 0.9, extra: { certSha256: "AA" } },
    ]);
    assert.equal(merged.length, 1);
    assert.deepEqual(merged[0].methods, ["ssdp", "tls-probe"]);
    assert.equal(merged[0].model, "P1S");
    assert.equal(merged[0].extra.certSha256, "AA");
    assert.ok(merged[0].confidence > 0.95);
  });

  it("attaches serial-less hint to serial record on same host; keeps other vendors separate", () => {
    const merged = mergeCandidates([
      { vendor: "creality", host: "192.168.1.80", serial: null, methods: ["mdns"], confidence: 0.5 },
      { vendor: "creality", host: "192.168.1.80", serial: "F012345", model: "K1C", methods: ["ws-probe"], confidence: 0.85 },
      { vendor: "klipper", host: "192.168.1.80", mac: "aa:bb:cc:00:11:22", methods: ["http-probe"], confidence: 0.9 },
    ]);
    assert.equal(merged.length, 2);
    const creality = merged.find((m) => m.vendor === "creality");
    assert.deepEqual(creality.methods.sort(), ["mdns", "ws-probe"]);
    const final = finalizeCandidates(merged);
    assert.equal(final[0].vendor, "creality");
    assert.ok(final[1].notes.some((n) => n.includes("marka sürücüsü")));
    assert.deepEqual(primaryCandidates(final).map((p) => p.vendor), ["creality"]);
  });

  it("dedupes same MAC across two IPs (Wi-Fi + Ethernet)", () => {
    const merged = mergeCandidates([
      { vendor: "klipper", host: "192.168.1.40", mac: "B8:27:EB:12:34:56", methods: ["mdns"], confidence: 0.7 },
      { vendor: "klipper", host: "192.168.1.41", mac: "b8-27-eb-12-34-56", methods: ["scan"], confidence: 0.9 },
    ]);
    assert.equal(merged.length, 1);
  });

  it("marks already paired printers and secrets", () => {
    const [p] = finalizeCandidates(
      mergeCandidates([{ vendor: "bambu", host: "192.168.1.151", serial: "01P00A123456789", methods: ["ssdp"], confidence: 0.95 }]),
      {
        pairedPrinters: [{ vendor: "bambu", serial: "01p00a123456789", machineId: "m-1", host: "192.168.1.10" }],
        slicerCodes: new Map([["01P00A123456789", "ZX81QW09"]]),
      }
    );
    assert.equal(p.paired, true);
    assert.equal(p.machineId, "m-1");
    assert.equal(p.needsSecret, "bambu_access_code");
    assert.equal(p.secretAvailable, true);
    assert.equal(JSON.stringify(p).includes("ZX81QW09"), false);
  });

  it("flags Bambu cloud alternative unless printer is LAN-only", () => {
    const [cloud] = finalizeCandidates(
      mergeCandidates([{ vendor: "bambu", host: "192.168.1.151", serial: "20P6BJ651701805", methods: ["ssdp"], confidence: 0.95, extra: { connectMode: "cloud" } }])
    );
    assert.equal(cloud.cloudAlternative, true);
    assert.equal(cloud.secretAvailable, false);
    assert.ok(cloud.notes.some((n) => n.includes("Bambu hesabını")));
    const [lan] = finalizeCandidates(
      mergeCandidates([{ vendor: "bambu", host: "192.168.1.152", serial: "01P00A123456789", methods: ["ssdp"], confidence: 0.95, extra: { connectMode: "lan" } }])
    );
    assert.equal(lan.cloudAlternative, false);
  });

  it("marks access codes fetched from the Bambu account without leaking them", () => {
    const printers = finalizeCandidates(
      mergeCandidates([{ vendor: "bambu", host: "192.168.1.151", serial: "20P6BJ651701805", methods: ["ssdp"], confidence: 0.95, extra: { connectMode: "cloud" } }])
    );
    markAccessCodes(printers, new Map([["20P6BJ651701805", "Q1W2E3R4"]]), "Bambu hesabı");
    assert.equal(printers[0].secretAvailable, true);
    assert.ok(printers[0].notes[0].includes("Bambu hesabı"));
    assert.ok(!printers[0].notes.some((n) => n.includes("Kod girmeden")));
    assert.equal(JSON.stringify(printers).includes("Q1W2E3R4"), false);
  });

  it("derives stable pairing serial", () => {
    assert.equal(pairingSerial({ vendor: "x", serial: "S1", host: "h" }), "S1");
    assert.equal(pairingSerial({ vendor: "x", serial: null, mac: "aa:bb:cc:dd:ee:ff", host: "h" }), "AABBCCDDEEFF");
    assert.equal(pairingSerial({ vendor: "octoprint", serial: null, mac: null, host: "1.2.3.4" }), "octoprint-1.2.3.4");
  });
});

describe("slicer access codes", () => {
  it("parses BambuStudio.conf with MD5 trailer", () => {
    const conf = `{\n "app": {"version": "1.9"},\n "access_code": {"01P00A123456789": "12345678", "bad": "x"},\n "user_access_code": {"00M09A111111111": "abcdEF12"}\n}\n# MD5 checksum 0123456789ABCDEF\n`;
    const doc = parseSlicerConf(conf);
    const codes = extractAccessCodes(doc);
    assert.equal(codes.get("01P00A123456789"), "12345678");
    assert.equal(codes.get("00M09A111111111"), "abcdEF12");
    assert.equal(codes.has("bad"), false);
  });

  it("finds {dev_id, access_code} arrays and survives garbage", () => {
    const codes = extractAccessCodes({ devices: [{ dev_id: "03919A222222222", access_code: "87654321" }] });
    assert.equal(codes.get("03919A222222222"), "87654321");
    assert.equal(parseSlicerConf("not json"), null);
  });

  it("includes Flatpak config dirs on Linux only", () => {
    const linux = slicerConfigPaths("linux", {}, "/home/u").map((p) => p.path);
    assert.ok(linux.includes("/home/u/.config/BambuStudio/BambuStudio.conf"));
    assert.ok(linux.includes("/home/u/.var/app/com.bambulab.BambuStudio/config/BambuStudio/BambuStudio.conf"));
    assert.ok(linux.includes("/home/u/.var/app/io.github.softfever.OrcaSlicer/config/OrcaSlicer/OrcaSlicer.conf"));
    const mac = slicerConfigPaths("darwin", {}, "/Users/u").map((p) => p.path);
    assert.deepEqual(mac, [
      "/Users/u/Library/Application Support/BambuStudio/BambuStudio.conf",
      "/Users/u/Library/Application Support/OrcaSlicer/OrcaSlicer.conf",
    ]);
  });
});

describe("Bambu cloud access codes (local)", () => {
  const BIND = {
    message: "success",
    devices: [
      { dev_id: "20P6BJ651701805", name: "X2D", dev_access_code: "Q1W2E3R4", dev_product_name: "X2D" },
      { dev_id: "bad", dev_access_code: "12345678" },
      { dev_id: "01P00A123456789", dev_access_code: "" },
    ],
  };

  it("extracts serial → dev_access_code from bind response", () => {
    const codes = accessCodesFromBind(BIND);
    assert.equal(codes.size, 1);
    assert.equal(codes.get("20P6BJ651701805"), "Q1W2E3R4");
    assert.equal(accessCodesFromBind(null).size, 0);
  });

  it("calls the bind API with the bearer token and maps auth errors", async () => {
    let seen;
    const ok = async (url, init) => {
      seen = { url, auth: init.headers.Authorization };
      return { ok: true, status: 200, json: async () => BIND };
    };
    const codes = await fetchBambuAccessCodes("tok-123", { fetchImpl: ok });
    assert.equal(seen.url, "https://api.bambulab.com/v1/iot-service/api/user/bind");
    assert.equal(seen.auth, "Bearer tok-123");
    assert.equal(codes.get("20P6BJ651701805"), "Q1W2E3R4");
    await fetchBambuAccessCodes("t", { fetchImpl: ok, region: "cn" });
    assert.ok(seen.url.startsWith("https://api.bambulab.cn/"));
    const denied = async () => ({ ok: false, status: 401, json: async () => ({}) });
    await assert.rejects(fetchBambuAccessCodes("t", { fetchImpl: denied }), /oturumu geçersiz/);
  });

  it("finds a token in plaintext session JSON", () => {
    assert.equal(findTokenInDoc({ user: { uid: "1", token: "eyJhbGciOiJIUzI1NiJ9.abcdefghijk.xyz" } }), "eyJhbGciOiJIUzI1NiJ9.abcdefghijk.xyz");
    assert.equal(findTokenInDoc({ token: "short" }), null);
  });

  it("reports encrypted / found / missing slicer sessions", () => {
    const dir = mkdtempSync(join(tmpdir(), "pf-slicer-"));
    const engine = join(dir, "BambuNetworkEngine.conf");
    const conf = join(dir, "BambuStudio.conf");
    const paths = [
      { app: "BambuStudio", path: engine },
      { app: "BambuStudio", path: conf },
    ];
    assert.equal(readSlicerCloudToken(paths).status, "missing");
    writeFileSync(engine, Buffer.from([0x8f, 0x01, 0xfe, 0x22, 0x10, 0x99]));
    writeFileSync(conf, '{"app":{"version":"2.0"}}');
    assert.deepEqual(readSlicerCloudToken(paths), { status: "encrypted", app: "BambuStudio", token: null });
    writeFileSync(engine, '{"user":{"access_token":"abcdefghijklmnopqrstuvwxyz0123"}}');
    const found = readSlicerCloudToken(paths);
    assert.equal(found.status, "found");
    assert.equal(found.token, "abcdefghijklmnopqrstuvwxyz0123");
  });
});

describe("Creality WS fingerprint", () => {
  it("recognizes Creality OS status payload", () => {
    const c = crealityFromWsMessage({ nozzleTemp: "210.0", bedTemp0: "60", model: "K1C", hostname: "K1C-2A3B", printProgress: 10 }, "192.168.1.80");
    assert.equal(c.vendor, "creality");
    assert.equal(c.model, "K1C");
    assert.equal(c.name, "K1C-2A3B");
    assert.equal(crealityFromWsMessage({ hello: "world" }, "1.1.1.1"), null);
  });
});
