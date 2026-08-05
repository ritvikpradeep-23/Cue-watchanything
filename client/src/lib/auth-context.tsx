import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { apiPost, getToken, setToken } from "./api";

interface User {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "watchrec_user";

function loadStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => (getToken() ? loadStoredUser() : null));

  const applySession = useCallback((token: string, user: User) => {
    setToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setUser(user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiPost<{ token: string; user: User }>("/auth/login", { email, password });
      applySession(res.token, res.user);
    },
    [applySession],
  );

  const signup = useCallback(
    async (email: string, password: string) => {
      const res = await apiPost<{ token: string; user: User }>("/auth/signup", { email, password });
      applySession(res.token, res.user);
    },
    [applySession],
  );

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
