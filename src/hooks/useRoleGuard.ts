import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const useRoleGuard = (allowedRoles: string[]) => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!profile) {
      navigate('/login');
      return;
    }
    if (profile.is_super_admin) return;
    if (!allowedRoles.includes(profile.role)) {
      navigate('/access-denied');
    }
  }, [profile, loading, allowedRoles, navigate]);

  return { profile, loading };
};
