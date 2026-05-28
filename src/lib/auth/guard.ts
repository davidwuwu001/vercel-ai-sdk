import { NextResponse } from "next/server";
import { isAdminSessionValid, isAuthConfigured } from "./session";

export async function requireAdminApi() {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      {
        error: "auth_not_configured",
        message: "管理员登录未配置。请在 .env.local 设置 ADMIN_PASSWORD 和 AUTH_SECRET。",
      },
      { status: 503 },
    );
  }

  const valid = await isAdminSessionValid();
  if (!valid) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "请先登录管理员账号。",
      },
      { status: 401 },
    );
  }

  return null;
}

export async function hasAdminAccess() {
  if (!isAuthConfigured()) return false;
  return isAdminSessionValid();
}
