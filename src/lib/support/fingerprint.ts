import { sanitizeClientErrorMessage } from "./redact";

export function truncateStack(stack: string | undefined, max = 4000): string | undefined {
  if (!stack) return undefined;
  return stack.slice(0, max);
}

/** Edge / tarayıcı / Node uyumlu (Node crypto kullanmaz) */
function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function errorFingerprint(input: {
  message: string;
  route?: string;
  source?: string;
}): string {
  const normalizedMessage = sanitizeClientErrorMessage(input.message)
    .replace(/\d+/g, "N")
    .slice(0, 500);
  const route = (input.route ?? "").split("?")[0] ?? "";
  const source = input.source ?? "unknown";
  const raw = `${source}|${route}|${normalizedMessage}`;
  return fnv1aHex(raw) + fnv1aHex(raw.split("").reverse().join(""));
}
