/** İç destek paneli — virgülle ayrılmış e-posta listesi */
export function getSupportAdminEmails(): string[] {
  const raw = process.env.SUPPORT_ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isSupportAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = getSupportAdminEmails();
  if (!list.length) return false;
  return list.includes(email.trim().toLowerCase());
}

export function supportEmailTo(): string {
  return process.env.SUPPORT_EMAIL_TO?.trim() || "info@3dyanimda.com";
}

export function supportEmailFrom(): string {
  return (
    process.env.SUPPORT_EMAIL_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "3D Assistant <onboarding@resend.dev>"
  );
}

export function appBuildLabel(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
    process.env.npm_package_version ||
    "dev"
  );
}
