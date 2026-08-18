const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_LENGTH_BITS = 256;

function toBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
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

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt.buffer)}$${toBase64(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1], 10);
  const salt = fromBase64(parts[2]);
  const expected = fromBase64(parts[3]);
  const derived = new Uint8Array(await deriveKey(password, salt, iterations));
  if (derived.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ expected[i];
  return diff === 0;
}

// --- JWT (HS256), minimal dependency-free implementation ---

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = btoa(String.fromCharCode(...buf));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export interface JwtPayload {
  sub: number;
  username: string;
  role: string;
  unitKerjaId: number | null;
  iss: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

export async function signJwt(payload: Omit<JwtPayload, "iat" | "exp"> & { exp: number }, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const iat = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat };
  const encHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = base64url(new TextEncoder().encode(JSON.stringify(fullPayload)));
  const signingInput = `${encHeader}.${encPayload}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64url(sig)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encHeader, encPayload, encSig] = parts;
  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64urlDecode(encSig),
    new TextEncoder().encode(`${encHeader}.${encPayload}`)
  );
  if (!valid) return null;
  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(encPayload))) as JwtPayload;
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomToken(bytes = 32): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return base64url(arr);
}
