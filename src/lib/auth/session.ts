import { cookies } from "next/headers";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "neon_agent_admin";

export function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN || "";
}

export function getSessionSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || getAdminPassword();
}

export function isAuthConfigured() {
  return Boolean(getAdminPassword());
}

export function createAdminSessionToken() {
  const password = getAdminPassword();
  const secret = getSessionSecret();
  if (!password || !secret) return "";
  return createHash("sha256").update(`${password}:${secret}`).digest("hex");
}

export async function isAdminSessionValid() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionToken(token);
}

export function verifyAdminSessionToken(token?: string) {
  const expected = createAdminSessionToken();
  if (!token || !expected) return false;

  try {
    const tokenBuffer = Buffer.from(token);
    const expectedBuffer = Buffer.from(expected);
    if (tokenBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(tokenBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export function verifyAdminPassword(password: string) {
  const expected = getAdminPassword();
  if (!expected) return false;

  try {
    const inputBuffer = Buffer.from(password);
    const expectedBuffer = Buffer.from(expected);
    if (inputBuffer.length !== expectedBuffer.length) {
      return password === expected;
    }
    return timingSafeEqual(inputBuffer, expectedBuffer);
  } catch {
    return password === expected;
  }
}

export function createSessionNonce() {
  return randomBytes(16).toString("hex");
}
