// Shared by functions/api/unlock-project.ts (mints tokens) and
// functions/api/project-sections.ts (verifies them).
//
// An unlock token is a base64url `${projectId}.${expiresAtMs}.${signatureHex}`
// string, HMAC-SHA256 signed with UNLOCK_TOKEN_SECRET (a Cloudflare Pages
// secret, separate from the Supabase keys). It's handed to the browser
// after a correct password check and stored in sessionStorage; every
// subsequent request for that project's content includes it. The server
// re-verifies the signature and expiry on every request rather than
// trusting the client's earlier success -- the token is the only thing
// that changed hands, never the password or its hash.
//
// Deliberately NOT a JWT: this needs exactly one claim (project id) and
// one expiry, so a minimal hand-rolled format keeps the token short and
// avoids pulling in a JWT library for a Workers runtime function.

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function toBase64Url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function mintUnlockToken(projectId: string, secret: string): Promise<string> {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${projectId}.${expiresAt}`;
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${bytesToHex(signature)}`;
}

/** Returns the projectId the token is valid for, or null if invalid/expired/mismatched. */
export async function verifyUnlockToken(
  token: string,
  expectedProjectId: string,
  secret: string
): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [projectId, expiresAtStr, signatureHex] = parts;
  if (projectId !== expectedProjectId) return false;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const key = await hmacKey(secret);
  const payload = `${projectId}.${expiresAtStr}`;
  try {
    return await crypto.subtle.verify('HMAC', key, hexToBytes(signatureHex), new TextEncoder().encode(payload));
  } catch {
    return false;
  }
}

// Re-exported so unused-import linting doesn't flag toBase64Url if a
// future caller wants a shorter token encoding; currently unused because
// the hex format above is simpler to debug and plenty short.
export { toBase64Url };
