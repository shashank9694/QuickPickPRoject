import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, AUTH_TOKEN_KEY, User, setTokenCache, clearTokenCache } from "@/src/api";
import { storage } from "@/src/utils/storage";

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // Hard timeout: never block UI for more than 4 seconds
    const timer = setTimeout(() => setLoading(false), 4000);
    try {
      const token = (await storage.secureGet<string>(AUTH_TOKEN_KEY, "")) ?? "";
      setTokenCache(token); // warm the in-memory cache for the interceptor

      if (!token) { setUser(null); return; }

      try {
        const res = await api.get<User>("/auth/me");
        setUser(res.data);
      } catch {
        await storage.secureRemove(AUTH_TOKEN_KEY);
        setUser(null);
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signIn = async (token: string, u: User) => {
    await storage.secureSet(AUTH_TOKEN_KEY, token);
    setTokenCache(token);
    setUser(u);
  };

  const signOut = async () => {
    await storage.secureRemove(AUTH_TOKEN_KEY);
    clearTokenCache();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
