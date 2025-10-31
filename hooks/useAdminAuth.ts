import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';

interface AdminUser {
  id: string;
  username: string;
  role: string;
  email?: string;
}

interface UseAdminAuthReturn {
  user: AdminUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAdminAuth(): UseAdminAuthReturn {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/auth-check', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const payload = await response.json();
        setUser({
          id: payload.user?.id || 'admin-user',
          username: payload.user?.username || 'admin',
          role: payload.user?.role || 'super_admin',
          email: payload.user?.email,
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('[useAdminAuth] failed to fetch session', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession().catch(() => {
      setLoading(false);
    });
  }, [fetchSession]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('[useAdminAuth] logout failed', error);
    } finally {
      setUser(null);
      router.push('/admin-login').catch(() => {
        /* no-op */
      });
    }
  }, [router]);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    logout,
    refresh: fetchSession,
  };
}

export function useRequireAdminAuth() {
  const router = useRouter();
  const auth = useAdminAuth();

  useEffect(() => {
    if (!auth.loading && !auth.isAuthenticated) {
      router.push('/admin-login').catch(() => {
        /* no-op */
      });
    }
  }, [auth.loading, auth.isAuthenticated, router]);

  return auth;
}
