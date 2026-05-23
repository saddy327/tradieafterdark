import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useGetMe, useRefreshToken } from "@workspace/api-client-react";

interface AuthUser {
  id: string;
  email: string;
  role: "TRADIE" | "CUSTOMER" | "ADMIN";
  emailVerifiedAt: string | null;
  tradieProfileId: string | null;
  tradieSlug: string | null;
  onboardingComplete: boolean;
}

interface AuthContext {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
}

const AuthCtx = createContext<AuthContext>({
  user: null,
  isLoading: true,
  setUser: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { data, isError, isSuccess } = useGetMe({
    query: {
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  });

  useEffect(() => {
    if (isSuccess && data) {
      setUser((data as any).user as AuthUser);
      setIsLoading(false);
    }
    if (isError) {
      setUser(null);
      setIsLoading(false);
    }
  }, [isSuccess, isError, data]);

  const logout = useCallback(() => {
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).finally(() => {
      setUser(null);
      window.location.href = "/";
    });
  }, []);

  return (
    <AuthCtx.Provider value={{ user, isLoading, setUser, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
