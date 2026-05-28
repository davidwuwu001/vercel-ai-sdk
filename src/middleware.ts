import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken, isAuthConfigured, verifyAdminSessionToken } from "@/lib/auth/session";

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const shouldProtect = PROTECTED_PREFIXES.some((path) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path),
  );
  if (!shouldProtect) return NextResponse.next();

  if (!isAuthConfigured()) {
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

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const valid = verifyAdminSessionToken(token || createAdminSessionToken());
  if (token && valid) return NextResponse.next();

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

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
