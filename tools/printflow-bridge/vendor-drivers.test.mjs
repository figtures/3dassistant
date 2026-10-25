import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  digestAuthorization,
  klipperTelemetry,
  octoPrintTelemetry,
  parseDigestChallenge,
  parseFlashforgeStatus,
  prusaLinkTelemetry,
  sdcpStatusRequest,
  sdcpTelemetry,
} from "./vendor-drivers.mjs";
import { bambuErrorMessage } from "./drivers.mjs";
import { parseDeepLink } from "./deeplink.mjs";

describe("vendor telemetry mapping", () => {
  it("Klipper print_stats", () => {
    const t = klipperTelemetry("S", {
      print_stats: { state: "printing", filename: "benchy.gcode", print_duration: 125.7 },
      display_status: { progress: 0.423 },
      extruder: { temperature: 215.2 },
      heater_bed: { temperature: 60 },
    });
    assert.equal(t.printerState, "printing");
    assert.equal(t.progressPercent, 42.3);
    assert.equal(t.jobName, "benchy.gcode");
    assert.equal(t.printTimeSeconds, 125);
    assert.equal(t.nozzleTempC, 215.2);
    const idle = klipperTelemetry("S", { print_stats: { state: "complete", filename: "x" } });
    assert.equal(idle.printerState, "idle");
    assert.equal(idle.jobName, null);
  });

  it("OctoPrint job + printer", () => {
    const t = octoPrintTelemetry(
      "S",
      { state: "Printing from SD", job: { file: { name: "a.gcode" } }, progress: { completion: 12.5, printTime: 60 } },
      { temperature: { tool0: { actual: 200 }, bed: { actual: 55 } } }
    );
    assert.equal(t.printerState, "printing");
    assert.equal(t.progressPercent, 12.5);
    assert.equal(t.bedTempC, 55);
    assert.equal(octoPrintTelemetry("S", { state: "Offline" }, null).connectionStatus, "disconnected");
  });

  it("PrusaLink v1 status", () => {
    const t = prusaLinkTelemetry("S", { printer: { state: "PAUSED", temp_bed: 60, temp_nozzle: 210 }, job: { progress: 33, time_printing: 10 } }, "x.bgcode");
    assert.equal(t.printerState, "paused");
    assert.equal(t.jobName, "x.bgcode");
    assert.equal(prusaLinkTelemetry("S", { printer: { state: "ATTENTION" } }).printerState, "error");
  });

  it("Elegoo SDCP status + request", () => {
    const t = sdcpTelemetry("ID", {
      CurrentStatus: [1],
      PrintInfo: { Status: 13, Filename: "c.gcode", CurrentTicks: 100, TotalTicks: 400 },
      TempOfNozzle: 220,
      TempOfHotbed: 60,
      TempOfBox: 30,
    });
    assert.equal(t.printerState, "printing");
    assert.equal(t.progressPercent, 25);
    assert.equal(t.chamberTempC, 30);
    assert.equal(sdcpTelemetry("ID", { CurrentStatus: [1], PrintInfo: { Status: 6 } }).printerState, "paused");
    assert.equal(sdcpTelemetry("ID", { CurrentStatus: [0] }).printerState, "idle");
    const req = sdcpStatusRequest("ID");
    assert.equal(req.Topic, "sdcp/request/ID");
    assert.equal(req.Data.Cmd, 0);
    assert.equal(req.Data.RequestID.length, 32);
  });

  it("Flashforge M119/M27/M105", () => {
    const s = parseFlashforgeStatus({
      m119: "CMD M119 Received.\r\nMachineStatus: BUILDING_FROM_SD\r\nCurrentFile: cube.gx\r\nok\r\n",
      m27: "CMD M27 Received.\r\nSD printing byte 25/100\r\nok\r\n",
      m105: "CMD M105 Received.\r\nT0:210.0/210.0 B:60.0/60.0\r\nok\r\n",
    });
    assert.equal(s.state, "printing");
    assert.equal(s.progress, 25);
    assert.equal(s.file, "cube.gx");
    assert.equal(s.nozzle, "210.0");
    assert.equal(parseFlashforgeStatus({ m119: "MachineStatus: READY" }).state, "idle");
  });
});

describe("HTTP Digest (PrusaLink)", () => {
  it("parses challenge and computes RFC 2617 response", () => {
    const ch = parseDigestChallenge('Digest realm="Printer API", nonce="abc123", qop="auth", opaque="xyz"');
    assert.deepEqual(ch, { realm: "Printer API", nonce: "abc123", qop: "auth", opaque: "xyz" });
    const header = digestAuthorization({ username: "maker", password: "pw", method: "GET", uri: "/api/v1/status", challenge: ch, cnonce: "c0ffee" });
    const md5 = (s) => createHash("md5").update(s).digest("hex");
    const expected = md5(`${md5("maker:Printer API:pw")}:abc123:00000001:c0ffee:auth:${md5("GET:/api/v1/status")}`);
    assert.ok(header.includes(`response="${expected}"`));
    assert.ok(header.includes("qop=auth"));
    assert.equal(parseDigestChallenge("Basic realm=x"), null);
  });
});

describe("Bambu error mapping", () => {
  it("maps auth / refused / timeout", () => {
    assert.match(bambuErrorMessage(new Error("Connection refused: Not authorized")), /erişim kodu hatalı/);
    assert.match(bambuErrorMessage(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })), /LAN Only/);
    assert.match(bambuErrorMessage(new Error("mqtt timeout")), /yanıt vermiyor/);
  });
});

describe("deep link", () => {
  it("parses printflow://pair", () => {
    assert.deepEqual(parseDeepLink("printflow://pair?code=123456&url=https%3A%2F%2Fapp.example.com%2F"), {
      code: "123456",
      url: "https://app.example.com",
    });
    assert.throws(() => parseDeepLink("printflow://unpair?code=123456&url=https://x"));
    assert.throws(() => parseDeepLink("printflow://pair?code=12&url=https://x"));
    assert.throws(() => parseDeepLink("https://pair?code=123456&url=https://x"));
  });
});
