const SECRET_KEY_RE =
  /^(access[_-]?code|password|api[_-]?key|bridge[_-]?token|token|secret|authorization|bambu[_-]?token|refresh[_-]?token|client[_-]?secret)$/i;

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** İlk 2 karakter + mask (köprü jetonu vb.) */
export function redactToken(value: string): string {
  const s = String(value);
  if (s.length <= 2) return "**";
  return `${s.slice(0, 2)}${"*".repeat(Math.min(8, s.length - 2))}`;
}

export function redactEmailsInText(text: string): string {
  return text.replace(EMAIL_RE, "[e-posta]");
}

export function redactSecretsDeep<T>(input: T, depth = 0): T {
  if (depth > 12) return input;
  if (input === null || input === undefined) return input;
  if (typeof input === "string") {
    return redactEmailsInText(input) as T;
  }
  if (Array.isArray(input)) {
    return input.map((v) => redactSecretsDeep(v, depth + 1)) as T;
  }
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (SECRET_KEY_RE.test(k) && typeof v === "string") {
        out[k] = redactToken(v);
      } else if (typeof v === "string") {
        out[k] = redactEmailsInText(v);
      } else {
        out[k] = redactSecretsDeep(v, depth + 1);
      }
    }
    return out as T;
  }
  return input;
}

export function sanitizeClientErrorMessage(message: string): string {
  let m = redactEmailsInText(message);
  m = m.replace(/\bBearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]");
  m = m.replace(/\b(re_|sk_|pk_)[A-Za-z0-9_-]{8,}/gi, "[token]");
  return m.slice(0, 2000);
}
