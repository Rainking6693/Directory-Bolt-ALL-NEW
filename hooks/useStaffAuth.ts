import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';

interface StaffUser {
  username: string;
  id: string;
  role: string;
}

interface UseStaffAuthReturn {
  user: StaffUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useStaffAuth(): UseStaffAuthReturn {
  const router = useRouter();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/staff/auth-check', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const payload = await response.json();
        setUser({
          id: payload.user?.id || 'staff-user',
          username: payload.user?.username || 'staffuser',
          role: payload.user?.role || 'staff_manager',
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('[useStaffAuth] failed to fetch session', error);
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
      await fetch('/api/staff/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('[useStaffAuth] logout failed', error);
    } finally {
      setUser(null);
      router.push('/staff-login').catch(() => {
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

export function useRequireStaffAuth() {
  const router = useRouter();
  const auth = useStaffAuth();

  useEffect(() => {
    if (!auth.loading && !auth.isAuthenticated) {
      router.push('/staff-login').catch(() => {
        /* no-op */
      });
    }
  }, [auth.loading, auth.isAuthenticated, router]);

  return auth;
}
