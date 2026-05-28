"use client";

import { LockKeyhole, LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "登录失败");
      }
      window.location.href = "/";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell grid min-h-screen place-items-center px-4 py-8">
      <form className="app-panel w-full max-w-md border p-6" onSubmit={login}>
        <div className="app-icon-tile mb-5 grid size-12 place-items-center border">
          <LockKeyhole className="size-6" />
        </div>
        <p className="app-hot font-mono text-xs uppercase tracking-[0.26em]">
          Admin Access
        </p>
        <h1 className="app-title mt-2 text-2xl font-semibold">登录 Neon Agent Lab</h1>
        <p className="app-muted mt-3 text-sm leading-6">
          请输入管理员密码。密码来自服务端环境变量 ADMIN_PASSWORD。
        </p>

        <label className="mt-6 block">
          <span className="app-muted mb-2 block font-mono text-xs uppercase tracking-[0.18em]">
            Password
          </span>
          <input
            autoFocus
            className="app-input h-12 w-full border px-4 outline-none"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="ADMIN_PASSWORD"
            type="password"
          />
        </label>

        {message ? (
          <div className="mt-4 border border-rose-300/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
            {message}
          </div>
        ) : null}

        <button
          className="app-button-hot mt-5 flex h-12 w-full items-center justify-center gap-2 border font-mono text-sm disabled:opacity-50"
          disabled={loading || !password}
          type="submit"
        >
          <LogIn className="size-4" />
          {loading ? "登录中..." : "登录"}
        </button>
      </form>
    </main>
  );
}
