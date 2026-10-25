export const SUPPORT_ATTACHMENT_BUCKET = "support-attachments";
export const MAX_SUPPORT_ATTACHMENTS = 3;
export const MAX_SUPPORT_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

export type SupportAttachmentMeta = {
  path: string;
  name: string;
  contentType: string;
  sizeBytes: number;
};

export function isAllowedAttachmentMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime.toLowerCase());
}

export function validateAttachmentMeta(
  items: SupportAttachmentMeta[],
  userId: string,
  folderId: string
): { ok: true } | { ok: false; error: string } {
  if (items.length > MAX_SUPPORT_ATTACHMENTS) {
    return { ok: false, error: `En fazla ${MAX_SUPPORT_ATTACHMENTS} görsel ekleyebilirsiniz` };
  }
  const prefix = `${userId}/${folderId}/`;
  for (const item of items) {
    if (!item.path.startsWith(prefix)) {
      return { ok: false, error: "Geçersiz ek dosya yolu" };
    }
    if (!isAllowedAttachmentMime(item.contentType)) {
      return { ok: false, error: "Yalnızca PNG, JPG veya WebP desteklenir" };
    }
    if (item.sizeBytes > MAX_SUPPORT_ATTACHMENT_BYTES || item.sizeBytes <= 0) {
      return { ok: false, error: "Her görsel en fazla 5 MB olabilir" };
    }
    if (!item.name || item.name.length > 200) {
      return { ok: false, error: "Geçersiz dosya adı" };
    }
  }
  return { ok: true };
}

export function supportAttachmentStoragePath(
  userId: string,
  folderId: string,
  fileName: string
): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return `${userId}/${folderId}/${Date.now()}-${safe}`;
}
