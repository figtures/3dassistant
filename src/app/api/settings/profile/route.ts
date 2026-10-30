import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/get-auth-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const fullName =
    profile?.full_name?.trim() ||
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    "";

  return NextResponse.json({
    fullName,
    email: user.email ?? profile?.email ?? "",
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    fullName?: string;
    email?: string;
    password?: string;
  };

  const supabase = await createClient();

  if (typeof body.fullName === "string") {
    const trimmed = body.fullName.trim();
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: trimmed || null })
      .eq("id", user.id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const { error: metaError } = await supabase.auth.updateUser({
      data: { full_name: trimmed || null },
    });
    if (metaError) {
      return NextResponse.json({ error: metaError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Geçerli bir e-posta girin" }, { status: 400 });
    }
    const { error } = await supabase.auth.updateUser({ email });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (typeof body.password === "string") {
    if (body.password.length < 8) {
      return NextResponse.json(
        { error: "Şifre en az 8 karakter olmalı" },
        { status: 400 }
      );
    }
    const { error } = await supabase.auth.updateUser({ password: body.password });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Güncellenecek alan belirtilmedi" }, { status: 400 });
}
