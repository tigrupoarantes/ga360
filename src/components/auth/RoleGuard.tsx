import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface RoleGuardProps {
  children: ReactNode;
  roles: string[];
}

export function RoleGuard({ children, roles }: RoleGuardProps) {
  const { role } = useAuth();

  if (!role || !roles.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
