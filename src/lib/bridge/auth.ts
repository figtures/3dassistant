import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "./crypto";

export type BridgeContext = {
  bridgeId: string;
  userId: string;
};

export async function bridgeFromBearer(authHeader: string | null): Promise<BridgeContext | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (token.length < 20) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("workshop_bridges")
    .select("id, user_id")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (!data) return null;
  return { bridgeId: data.id, userId: data.user_id };
}
