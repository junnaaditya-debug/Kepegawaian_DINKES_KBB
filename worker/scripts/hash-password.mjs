// Dev utility to generate a pbkdf2 password hash compatible with src/lib/crypto.ts,
// e.g. for seeding an initial admin user or resetting a password directly in D1.
// Usage: node scripts/hash-password.mjs "SomePassword123!"
import { webcrypto as crypto } from "node:crypto";

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_LENGTH_BITS = 256;

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

async function deriveKey(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    KEY_LENGTH_BITS
  );
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(derived)}`;
}

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.mjs <password>");
  process.exit(1);
}
hashPassword(password).then((hash) => console.log(hash));
