'use client';

import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
});

/**
 * Client-side auth provider that checks if user is authenticated
 * Used for showing/hiding admin UI elements (cosmetic only - real security is server-side)
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/users/me', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setIsAuthenticated(!!data.user);
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth state from any component
 */
export function useAuth() {
  return useContext(AuthContext);
}
