import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface RoleGuardProps {
  children: ReactNode;
  roles?: string[];
  permission?: {
    module: string;
    action?: string;
  };
}

export function RoleGuard({ children, roles, permission }: RoleGuardProps) {
  const { role, checkPermission } = useAuth();

  const hasRoleAccess = roles ? (role && roles.includes(role)) : false;
  const hasPermissionAccess = permission ? checkPermission(permission.module, permission.action) : false;

  // If neither prop provided, deny (or maybe allow? safer to deny)
  if (!roles && !permission) return null;

  // If either requirement is met, allow access
  // Note: checkPermission already returns true for Super Admin/CEO
  if (!hasRoleAccess && !hasPermissionAccess) {
    return null;
  }

  return <>{children}</>;
}
