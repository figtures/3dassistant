const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;

/** Köprünün bildirdiği yazıcı adresi: IPv4 veya yerel ad (ör. k2pro.local). */
export function isValidLanHost(host: string): boolean {
  const h = host.trim();
  if (/^[\d.]+$/.test(h)) return IPV4.test(h);
  return HOSTNAME.test(h);
}
