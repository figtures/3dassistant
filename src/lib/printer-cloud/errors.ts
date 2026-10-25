/** Üretici hesabının yetkisi geçersiz — kullanıcı yeniden bağlamalı. */
export class CloudAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudAuthError";
  }
}

export function isCloudAuthError(e: unknown): e is CloudAuthError {
  return e instanceof CloudAuthError;
}
