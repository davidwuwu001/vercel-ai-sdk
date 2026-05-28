"use client";

import { LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function AdminLogoutButton() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  if (pathname === "/login") return null;

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <button
      className="fixed bottom-4 right-4 z-50 flex h-10 items-center gap-2 border border-white/10 bg-black/70 px-3 font-mono text-xs text-white/80 backdrop-blur transition hover:text-white disabled:opacity-50"
      disabled={loading}
      onClick={() => void logout()}
      type="button"
    >
      <LogOut className="size-4" />
      {loading ? "退出中" : "退出"}
    </button>
  );
}
