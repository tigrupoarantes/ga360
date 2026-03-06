import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
  requiredPermission?: {
    module: string;
    action?: string;
  };
}

export function ProtectedRoute({ children, allowedRoles, requiredPermission }: ProtectedRouteProps) {
  const { user, role, loading, checkPermission } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth', { replace: true });
      return;
    }

    if (!loading && user) {
      let isAllowed = true;

      // Check roles if defined
      if (allowedRoles && allowedRoles.length > 0) {
        if (!role || !allowedRoles.includes(role)) {
          isAllowed = false;
        }
      }

      // Check permissions if defined
      // If we failed role check, we might pass permission check?
      // Usually "Protected Route" implies stricter requirements.
      // Let's assume if BOTH are provided, it might mean OR or AND.
      // Given the refactor, let's treat them as OR checks (if you have role OR permission).
      // But wait, `checkPermission` handles super_admin bypass.

      // Let's simplify:
      // If `requiredPermission` is provided, it dictates access.
      // If `allowedRoles` is *also* provided, it's ambiguous.
      // Let's assume logical OR: access matches if Role matches OR Permission matches.

      const hasRoleAccess = allowedRoles ? (role && allowedRoles.includes(role)) : null;
      const hasPermissionAccess = requiredPermission ? checkPermission(requiredPermission.module, requiredPermission.action) : null;

      let accessGranted = true;

      // Both provided: require BOTH (AND) — prevents privilege escalation via permission alone
      if (allowedRoles && requiredPermission) {
        accessGranted = !!(hasRoleAccess && hasPermissionAccess);
      } else if (allowedRoles) {
        accessGranted = !!hasRoleAccess;
      } else if (requiredPermission) {
        accessGranted = !!hasPermissionAccess;
      }

      if (!accessGranted) {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, role, loading, allowedRoles, requiredPermission, navigate, checkPermission]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Render logic mirroring the effect check to prevent flash
  const hasRoleAccess = allowedRoles ? (role && allowedRoles.includes(role)) : null;
  const hasPermissionAccess = requiredPermission ? checkPermission(requiredPermission.module, requiredPermission.action) : null;

  let accessGranted = true;
  if (allowedRoles && requiredPermission) {
    accessGranted = !!(hasRoleAccess || hasPermissionAccess);
  } else if (allowedRoles) {
    accessGranted = !!hasRoleAccess;
  } else if (requiredPermission) {
    accessGranted = !!hasPermissionAccess;
  }

  if (!accessGranted) return null;

  return <>{children}</>;
}
