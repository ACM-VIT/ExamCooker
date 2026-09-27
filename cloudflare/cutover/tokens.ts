const encoder = new TextEncoder();
const keys = new Map<string, Promise<CryptoKey>>();
function key(secret: string) {
  if (!keys.has(secret)) keys.set(secret, crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]));
  return keys.get(secret)!;
}
function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function decode(value: string) {
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
}
export async function sign(value: object, secret: string) {
  const payload = encode(encoder.encode(JSON.stringify(value)));
  const mac = await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(payload));
  return `${payload}.${encode(new Uint8Array(mac))}`;
}
export async function verify<T>(token: string, secret: string): Promise<T | null> {
  try {
    if (token.length > 2048) return null;
    const parts = token.split(".");
    if (parts.length !== 2 || !await crypto.subtle.verify("HMAC", await key(secret), decode(parts[1]), encoder.encode(parts[0]))) return null;
    return JSON.parse(new TextDecoder().decode(decode(parts[0])));
  } catch { return null; }
}
