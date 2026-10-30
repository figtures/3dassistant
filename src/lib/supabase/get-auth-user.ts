import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAuthRateLimitError } from "@/lib/supabase/auth-cookies";

/** Sunucu bileşenleri için istek başına tek Supabase getUser çağrısı. */
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (user) return user;

  if (error && !isAuthRateLimitError(error)) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
});
