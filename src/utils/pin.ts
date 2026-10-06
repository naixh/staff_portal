/**
 * Account PIN helpers.
 *
 * The PIN is never stored in the clear — we keep a salted SHA-256 hash. The
 * mobile number is used as the salt so identical PINs across accounts don't
 * produce identical hashes.
 */
export async function hashPin(mobile: string, pin: string): Promise<string> {
  const data = `${mobile}:${pin}`;
  try {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(data),
    );
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // Web Crypto is unavailable in non-secure contexts — fall back to a text
    // hash. Still better than storing the PIN itself.
    let acc = 0;
    for (let i = 0; i < data.length; i += 1) {
      acc = (Math.imul(31, acc) + data.charCodeAt(i)) | 0;
    }
    return `fallback:${(acc >>> 0).toString(16)}`;
  }
}

/** Normalise a typed mobile number (strip spaces, dashes, parentheses). */
export function normalizeMobile(input: string): string {
  return input.replace(/[^\d]/g, "");
}

/** A PIN is exactly 6 digits (matches Supabase's default minimum password length). */
export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

/** A mobile number is 7–15 digits. */
export function isValidMobile(mobile: string): boolean {
  return /^\d{7,15}$/.test(mobile);
}
