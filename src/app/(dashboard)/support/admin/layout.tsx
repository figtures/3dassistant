import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupportAdminEmail } from "@/lib/support/admin";

export default async function SupportAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isSupportAdminEmail(user.email)) {
    notFound();
  }

  return children;
}
