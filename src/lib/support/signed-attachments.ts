import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPPORT_ATTACHMENT_BUCKET, type SupportAttachmentMeta } from "./attachments";

const DEFAULT_EXPIRY_SEC = 7 * 24 * 60 * 60;

export async function signedSupportAttachments(
  admin: SupabaseClient,
  attachments: SupportAttachmentMeta[],
  expiresIn = DEFAULT_EXPIRY_SEC
): Promise<Array<SupportAttachmentMeta & { signedUrl?: string }>> {
  const out: Array<SupportAttachmentMeta & { signedUrl?: string }> = [];
  for (const att of attachments) {
    const { data, error } = await admin.storage
      .from(SUPPORT_ATTACHMENT_BUCKET)
      .createSignedUrl(att.path, expiresIn);
    out.push({
      ...att,
      signedUrl: error ? undefined : data?.signedUrl,
    });
  }
  return out;
}
