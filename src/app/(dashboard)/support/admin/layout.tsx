import { notFound } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/get-auth-user";
import { isSupportAdminEmail } from "@/lib/support/admin";

export default async function SupportAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();

  if (!user || !isSupportAdminEmail(user.email)) {
    notFound();
  }

  return children;
}
