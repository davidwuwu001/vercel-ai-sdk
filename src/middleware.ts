import { NextRequest, NextResponse } from "next/server";

const ADMIN_SESSION_COOKIE = "neon_agent_admin";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/_next",
  "/favicon.ico",
];

const PROTECTED_PREFIXES = [
  "/",
  "/admin",
  "/lab",
  "/api/chat",
  "/api/chat-sessions",
  "/api/models",
  "/api/documents",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const shouldProtect = PROTECTED_PREFIXES.some((path) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path),
  );
  if (!shouldProtect) return NextResponse.next();

  const adminPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN || "";
  const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || adminPassword;

  if (!adminPassword || !authSecret) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "auth_not_configured",
          message: "管理员登录未配置。请在 .env.local 设置 ADMIN_PASSWORD 和 AUTH_SECRET。",
        },
        { status: 503 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "auth_not_configured");
    return NextResponse.redirect(url);
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value || "";
  const expected = await sha256Hex(`${adminPassword}:${authSecret}`);
  if (token && safeEqual(token, expected)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "请先登录管理员账号。",
      },
      { status: 401 },
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

async function sha256Hex(value: string) {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index++) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
