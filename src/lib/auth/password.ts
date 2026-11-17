import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;

/**
 * Hashes a plaintext password using Node's built-in scrypt with a random 16-byte salt.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${derived}`;
}

/**
 * Verifies a plaintext password against a stored `salt:hash` string in constant time.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;

  const keyBuffer = Buffer.from(keyHex, "hex");
  const derivedBuffer = scryptSync(password, salt, KEY_LENGTH);
  if (keyBuffer.length !== derivedBuffer.length) return false;

  return timingSafeEqual(keyBuffer, derivedBuffer);
}
