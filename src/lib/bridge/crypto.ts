import { createHash, randomBytes, randomInt } from "node:crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateBridgeToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generatePairingCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

export function hashPairingCode(code: string): string {
  return hashToken(code.trim());
}
