const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateBundleCode(): string {
  let s = "BDL-";
  for (let i = 0; i < 8; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}
