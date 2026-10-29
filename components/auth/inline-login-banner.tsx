"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import type { useSigapSession } from "@/hooks/useSigapSession";

interface InlineLoginBannerProps {
  session: ReturnType<typeof useSigapSession>;
  description: string;
  /** Shown next to the active session when the signed-in role lacks permission. */
  roleNotice?: string | null;
}

export function InlineLoginBanner({ session, description, roleNotice }: InlineLoginBannerProps) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const { actor, busy, error, login } = session;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password || busy) return;
    if (await login(userId, password)) setPassword("");
  };

  if (actor) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-slate-600">Active session:</span>
          <span className="font-semibold text-slate-900">{actor.id}</span>
          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold uppercase">
            {actor.role}
          </span>
        </div>
        {roleNotice && <span className="text-amber-700 text-[11px] font-medium">{roleNotice}</span>}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-700" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
            Authentication Required
          </span>
        </div>
        <p className="text-xs text-amber-700 mt-0.5">{description}</p>
        {error && <p className="text-xs font-semibold text-rose-600 mt-1">{error}</p>}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 shrink-0">
        <input
          type="text"
          placeholder="User ID"
          aria-label="User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-28 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={busy}
        />
        <input
          type="password"
          placeholder="Password"
          aria-label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-28 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !userId || !password}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
        >
          {busy ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
