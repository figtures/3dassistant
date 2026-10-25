import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, "printflow-integration-v1", 32);
}

export function getIntegrationEncryptionKey(): string | null {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  return key || null;
}

export function requireIntegrationEncryptionKey(): string {
  const key = getIntegrationEncryptionKey();
  if (!key) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY tanımlı değil — üretimde bulut hesap anahtarları şifrelenemez"
    );
  }
  if (key.length < 32) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY en az 32 karakter olmalı");
  }
  return key;
}

export function encryptIntegrationSecret(plain: string): string {
  if (!plain) return plain;
  const envKey = getIntegrationEncryptionKey();
  if (!envKey) {
    if (isProductionRuntime()) {
      requireIntegrationEncryptionKey();
    }
    return plain;
  }
  const key = deriveKey(envKey);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, enc]).toString("base64url");
  return `${PREFIX}${payload}`;
}

export function decryptIntegrationSecret(stored: string | null): string | null {
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) {
    return stored;
  }
  const envKey = getIntegrationEncryptionKey();
  if (!envKey) {
    throw new Error("Şifreli anahtar çözülemedi — INTEGRATION_ENCRYPTION_KEY gerekli");
  }
  const key = deriveKey(envKey);
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64url");
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + 16);
  const data = raw.subarray(IV_LEN + 16);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}
