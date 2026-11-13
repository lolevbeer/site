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

/** Set by the admin panel (AdminBrowserMarker): only these browsers can hold a session. */
export const ADMIN_BROWSER_KEY = 'lolev-admin-browser';

/**
 * Client-side auth provider that checks if user is authenticated
 * Used for showing/hiding admin UI elements (cosmetic only - real security is server-side)
 *
 * The session cookie is HttpOnly, so only the server can read it. To spare every
 * anonymous page load that uncached Payload call, it runs only in browsers that
 * have opened the admin panel.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        if (!localStorage.getItem(ADMIN_BROWSER_KEY)) return;

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
