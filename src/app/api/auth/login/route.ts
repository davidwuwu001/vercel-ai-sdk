import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  isAuthConfigured,
  verifyAdminPassword,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: "auth_not_configured",
        message: "管理员登录未配置。请在 .env.local 设置 ADMIN_PASSWORD 和 AUTH_SECRET。",
      },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";

  if (!verifyAdminPassword(password)) {
    return NextResponse.json(
      {
        success: false,
        error: "invalid_password",
        message: "管理员密码不正确。",
      },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
