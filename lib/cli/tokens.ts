import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ACCESS_TOKEN_PREFIX = "ec_";
const DEVICE_CODE_BYTES = 32;
const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const USER_CODE_LENGTH = 8;

function getCliSigningSecret() {
  const secret =
    process.env.EXAMCOOKER_CLI_TOKEN_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error(
      "Missing EXAMCOOKER_CLI_TOKEN_SECRET, AUTH_SECRET, or NEXTAUTH_SECRET.",
    );
  }

  return secret;
}

function hmac(value: string) {
  return createHmac("sha256", getCliSigningSecret())
    .update(value)
    .digest("base64url");
}

function tokenSignature(tokenId: string) {
  return hmac(`cli-access-token:${tokenId}`);
}

export function buildCliAccessToken(tokenId: string) {
  return `${ACCESS_TOKEN_PREFIX}${tokenId}.${tokenSignature(tokenId)}`;
}

export function verifyCliAccessToken(token: string) {
  if (!token.startsWith(ACCESS_TOKEN_PREFIX)) {
    return null;
  }

  const raw = token.slice(ACCESS_TOKEN_PREFIX.length);
  const separatorIndex = raw.indexOf(".");
  if (separatorIndex <= 0) {
    return null;
  }

  const tokenId = raw.slice(0, separatorIndex);
  const providedSignature = raw.slice(separatorIndex + 1);
  if (!tokenId || !providedSignature) {
    return null;
  }

  const expectedSignature = tokenSignature(tokenId);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  return tokenId;
}

export function generateCliDeviceCode() {
  return randomBytes(DEVICE_CODE_BYTES).toString("base64url");
}

export function hashCliDeviceCode(deviceCode: string) {
  return createHash("sha256")
    .update(`cli-device-code:${deviceCode}`)
    .digest("hex");
}

export function normalizeCliUserCode(userCode: string) {
  const normalized = userCode.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (normalized.length <= 4) {
    return normalized;
  }

  return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
}

export function generateCliUserCode() {
  let code = "";
  for (let index = 0; index < USER_CODE_LENGTH; index += 1) {
    const randomIndex = randomBytes(1)[0] % USER_CODE_ALPHABET.length;
    code += USER_CODE_ALPHABET[randomIndex];
  }

  return normalizeCliUserCode(code);
}

export function buildCliTokenLabel(deviceName: string | null | undefined) {
  const trimmed = deviceName?.trim();
  return trimmed ? `CLI · ${trimmed}` : "CLI";
}
