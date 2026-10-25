/** Köprü kamera yükleme gövdesi (JSON). */

export const MAX_CAMERA_FRAME_BYTES = 2 * 1024 * 1024;

export type BridgeCameraUpload = {
  machineId: string;
  imageBase64: string;
  contentType: string;
};

const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export function parseBridgeCameraUpload(body: unknown): BridgeCameraUpload | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const machineId = typeof o.machineId === "string" ? o.machineId.trim() : "";
  if (!machineId) return null;

  const rawB64 = typeof o.imageBase64 === "string" ? o.imageBase64.trim() : "";
  if (!rawB64) return null;

  const imageBase64 = rawB64.includes(",") ? rawB64.split(",").pop()!.trim() : rawB64;
  if (!/^[A-Za-z0-9+/=\s]+$/.test(imageBase64.replace(/\s/g, ""))) return null;

  let buf: Buffer;
  try {
    buf = Buffer.from(imageBase64.replace(/\s/g, ""), "base64");
  } catch {
    return null;
  }
  if (buf.length < 64 || buf.length > MAX_CAMERA_FRAME_BYTES) return null;

  const ctRaw = typeof o.contentType === "string" ? o.contentType.trim().toLowerCase() : "image/jpeg";
  const contentType = ALLOWED_TYPES.has(ctRaw) ? (ctRaw === "image/jpg" ? "image/jpeg" : ctRaw) : "image/jpeg";

  return { machineId, imageBase64: imageBase64.replace(/\s/g, ""), contentType };
}

export function bridgeCameraUploadToBuffer(upload: BridgeCameraUpload): Buffer {
  return Buffer.from(upload.imageBase64, "base64");
}
