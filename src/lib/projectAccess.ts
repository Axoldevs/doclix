// Password gating for "password" visibility projects.
//
// Uses Web Crypto's PBKDF2 (available in both the browser and the
// Cloudflare Workers runtime Pages Functions run on) with a high
// iteration count, which is deliberately slow -- unlike a single
// SHA-256 pass, this resists offline brute-forcing if the
// `password_hash` column is ever exposed (e.g. a misconfigured RLS
// policy, a DB backup leak). A per-project random salt keeps two
// projects that share a password from producing identical hashes, and
// an optional server-side pepper (UNLOCK_TOKEN_SECRET-adjacent, but
// kept as its own secret) means the hash alone -- without also holding
// the Cloudflare secret -- isn't enough to verify guesses at all.
//
// IMPORTANT: hashing and verification now only happen server-side, in
// functions/api/project-password.ts (set/change) and
// functions/api/unlock-project.ts (verify). The browser never computes
// or sees a hash; it only ever sends/receives plaintext passwords over
// HTTPS to those two endpoints, the same trust model as a normal login
// form. This file is imported by both functions (server) and, for the
// small `projectUnlockKey` helper, by client code.

const PBKDF2_ITERATIONS = 210_000;

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function randomSaltHex(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes.buffer);
}

async function pbkdf2Hex(password: string, saltHex: string, pepper: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password + pepper),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      // TS's DOM lib types crypto.subtle's `salt` as BufferSource backed
      // by a plain (non-shared) ArrayBuffer; hexToBytes's Uint8Array
      // satisfies that at runtime everywhere this actually executes
      // (browser + Workers), but its inferred type is the more general
      // ArrayBufferLike. Casting through `.buffer as ArrayBuffer` keeps
      // the assignment honest without a broad `as unknown as`.
      salt: hexToBytes(saltHex).buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bytesToHex(bits);
}

/**
 * Produces a "salt:hash" string suitable for storing in
 * `projects.password_hash`. `pepper` should be the UNLOCK_TOKEN_SECRET
 * (or a dedicated PASSWORD_PEPPER) Cloudflare Pages secret -- never a
 * value the client could supply or that lives in the database itself.
 */
export async function hashProjectPassword(plainPassword: string, pepper: string): Promise<string> {
  const salt = randomSaltHex();
  const hash = await pbkdf2Hex(plainPassword, salt, pepper);
  return `${salt}:${hash}`;
}

/** Checks a plaintext password attempt against a stored "salt:hash" string. */
export async function verifyProjectPassword(
  plainPassword: string,
  storedHash: string,
  pepper: string
): Promise<boolean> {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const attemptHash = await pbkdf2Hex(plainPassword, salt, pepper);
  // Constant-time comparison: hash lengths are fixed (64 hex chars for a
  // 256-bit digest), so a simple XOR-accumulate over equal-length hex
  // strings avoids leaking match position via early-exit timing, which a
  // plain `===` string comparison would not.
  if (attemptHash.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < attemptHash.length; i++) {
    diff |= attemptHash.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return diff === 0;
}

/** sessionStorage key used to remember a successful unlock for this tab session. */
export function projectUnlockKey(projectId: string): string {
  return `doclix-unlocked-${projectId}`;
}

