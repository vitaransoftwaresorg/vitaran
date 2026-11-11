import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SALT_BYTES = 16;
const KEY_LENGTH = 64;
/** Hash of the lowercased password, so login ignores letter case. */
const CASELESS = "scryptci";
/** Older hashes of the password exactly as typed. */
const LEGACY = "scrypt";

function deriveKey(password: string, salt: Buffer, length = KEY_LENGTH): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

/** Format: `scryptci$<salt>$<key>` (base64), so the algorithm can change later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password.toLowerCase(), salt);
  return `${CASELESS}$${salt.toString("base64")}$${key.toString("base64")}`;
}

/** Case spellings a legacy password may have been set with, given what was typed. */
function legacyCandidates(password: string) {
  const lower = password.toLowerCase();
  const swapped = [...password]
    .map((ch) => (ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase()))
    .join("");
  return [...new Set([password, lower, password.toUpperCase(), lower.charAt(0).toUpperCase() + lower.slice(1), swapped])];
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, saltText, keyText] = stored.split("$");
  if (!saltText || !keyText) return false;
  const salt = Buffer.from(saltText, "base64");
  const expected = Buffer.from(keyText, "base64");
  const matches = async (candidate: string) =>
    timingSafeEqual(await deriveKey(candidate, salt, expected.length), expected);

  if (algorithm === CASELESS) return matches(password.toLowerCase());
  if (algorithm !== LEGACY) return false;
  for (const candidate of legacyCandidates(password)) {
    if (await matches(candidate)) return true;
  }
  return false;
}

/** Legacy hashes are case-sensitive; rehash them after a successful login. */
export function passwordNeedsRehash(stored: string) {
  return !stored.startsWith(`${CASELESS}$`);
}
