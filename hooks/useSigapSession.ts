"use client";

import { useState, useEffect, useCallback } from "react";

export interface SessionActor {
  id: string;
  role: string;
}

/**
 * Cookie session + CSRF token for mutating API calls (analyze, batch release, review).
 */
export function useSigapSession() {
  const [actor, setActor] = useState<SessionActor | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expire = useCallback(() => {
    setActor(null);
    setCsrfToken(null);
  }, []);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success && json.data) {
          setActor(json.data.actor);
          setCsrfToken(json.data.csrfToken);
        } else {
          expire();
        }
      })
      .catch(expire);
  }, [expire]);

  const login = useCallback(async (userId: string, password: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId.trim(), password }),
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setActor(json.data.actor);
        setCsrfToken(json.data.csrfToken);
        return true;
      }
      setError(json.error || "Invalid user ID or password.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setBusy(false);
    }
    return false;
  }, []);

  return { actor, csrfToken, login, busy, error, expire };
}
