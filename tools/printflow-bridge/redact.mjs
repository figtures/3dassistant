const SECRET_KEY_RE =
  /^(access[_-]?code|password|api[_-]?key|bridge[_-]?token|token|secret|authorization|bambu[_-]?token)$/i;

export function redactToken(value) {
  const s = String(value);
  if (s.length <= 2) return "**";
  return `${s.slice(0, 2)}${"*".repeat(Math.min(8, s.length - 2))}`;
}

export function redactSecretsDeep(input, depth = 0) {
  if (depth > 12) return input;
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map((v) => redactSecretsDeep(v, depth + 1));
  if (typeof input === "object") {
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      if (SECRET_KEY_RE.test(k) && typeof v === "string") out[k] = redactToken(v);
      else out[k] = redactSecretsDeep(v, depth + 1);
    }
    return out;
  }
  return input;
}

export function summarizeConfig(cfg) {
  if (!cfg) return null;
  return redactSecretsDeep({
    printflowUrl: cfg.printflowUrl,
    bridgeToken: cfg.bridgeToken,
    printerCount: cfg.printers?.length ?? 0,
    printers: (cfg.printers ?? []).map((p) => ({
      machineId: p.machineId,
      vendor: p.vendor,
      serial: p.serial,
      host: p.host,
      mac: p.mac,
      model: p.model,
      hasAccessCode: Boolean(p.accessCode),
      hasApiKey: Boolean(p.apiKey),
      hasPassword: Boolean(p.password),
    })),
  });
}
