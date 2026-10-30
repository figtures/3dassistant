type HumanizeContext = {
  context?: string;
};

function messageFromCode(code: string | undefined): string | null {
  switch (code) {
    case "invalid_credentials":
      return "E-posta veya şifre hatalı.";
    case "email_not_confirmed":
      return "E-posta adresinizi doğrulamanız gerekiyor. Gelen kutunuzu kontrol edin.";
    case "user_already_exists":
      return "Bu e-posta adresiyle zaten bir hesap var.";
    case "weak_password":
      return "Şifre çok zayıf. En az 6 karakter ve daha güçlü bir şifre seçin.";
    case "over_email_send_rate_limit":
      return "Çok fazla e-posta gönderildi. Lütfen birkaç dakika sonra tekrar deneyin.";
    case "otp_expired":
    case "expired_token":
      return "Bağlantının süresi doldu. Yeni bir sıfırlama linki isteyin.";
    case "same_password":
      return "Yeni şifre mevcut şifrenizle aynı olamaz.";
    default:
      return null;
  }
}

function messageFromStatus(status: number | undefined): string | null {
  if (status === 429) {
    return "Çok fazla deneme. Lütfen bir süre sonra tekrar deneyin.";
  }
  return null;
}

/** Supabase Auth ve ağ hatalarını kullanıcıya Türkçe gösterir. */
export function humanizeAuthError(
  error: unknown,
  _opts?: HumanizeContext
): string {
  if (!error) {
    return "Bir şeyler ters gitti. Tekrar deneyin.";
  }

  if (error instanceof Error) {
    const withCode = error as Error & { code?: string; status?: number };
    const fromCode = messageFromCode(withCode.code);
    if (fromCode) return fromCode;

    const fromStatus = messageFromStatus(withCode.status);
    if (fromStatus) return fromStatus;

    const msg = withCode.message?.toLowerCase() ?? "";
    if (msg.includes("invalid login credentials")) {
      return "E-posta veya şifre hatalı.";
    }
    if (msg.includes("network") || msg.includes("fetch")) {
      return "Bağlantı kurulamadı. İnternet bağlantınızı kontrol edin.";
    }
    if (withCode.message && /[\u0080-\uFFFF]/.test(withCode.message)) {
      return withCode.message;
    }
  }

  return "Bir şeyler ters gitti. Tekrar deneyin.";
}
