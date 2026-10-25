/** printflow://pair?code=123456&url=https://… → { code, url } */
export function parseDeepLink(raw) {
  let u;
  try {
    u = new URL(String(raw ?? "").trim());
  } catch {
    throw new Error(`Geçersiz bağlantı: ${raw}`);
  }
  const action = u.hostname || u.pathname.replace(/^\/+/, "").replace(/\/$/, "");
  if (u.protocol !== "printflow:" || action !== "pair") {
    throw new Error(`Desteklenmeyen bağlantı: ${raw}`);
  }
  const code = u.searchParams.get("code")?.replace(/\s/g, "");
  const url = u.searchParams.get("url")?.trim().replace(/\/$/, "");
  if (!code || !url) throw new Error("Bağlantıda code ve url gerekli");
  if (!/^\d{6}$/.test(code)) throw new Error("Eşleştirme kodu 6 haneli olmalı");
  if (!/^https?:\/\/[^/\s]+/.test(url)) throw new Error("url http(s) olmalı");
  return { code, url };
}
