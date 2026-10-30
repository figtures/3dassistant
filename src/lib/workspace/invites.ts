import { randomBytes } from "node:crypto";
import { hashToken } from "@/lib/bridge/crypto";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return hashToken(token.trim());
}

export function inviteExpiresAt(from = Date.now()): string {
  return new Date(from + INVITE_TTL_MS).toISOString();
}
