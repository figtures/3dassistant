const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Kısa okunabilir bilet kodu: PF-XXXXXX */
export function generateTicketId(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `PF-${suffix}`;
}

export function isValidTicketId(id: string): boolean {
  return /^PF-[A-Z2-9]{6}$/.test(id);
}
