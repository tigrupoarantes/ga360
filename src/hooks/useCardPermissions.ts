import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { useAuth } from "@/contexts/AuthContext";

export interface CardPermission {
  card_id: string;
  can_view: boolean;
  can_fill: boolean;
  can_review: boolean;
  can_manage: boolean;
}

export function useCardPermissions() {
  const { user, role, checkPermission } = useAuth();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ['ec-card-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('ec_card_permissions')
        .select('card_id, can_view, can_fill, can_review, can_manage')
        .eq('user_id', user.id);

      if (error) throw error;
      return (data || []) as CardPermission[];
    },
    enabled: !!user?.id,
  });

  const isSuperAdmin = role === 'super_admin';

  const hasCardPermission = (cardId: string, permission: 'view' | 'fill' | 'review' | 'manage'): boolean => {
    // Only super_admin bypasses card-level permissions
    if (isSuperAdmin) return true;

    // Module-level access does NOT grant access to all cards
    // Users must have explicit card-level permissions in ec_card_permissions

    const perm = permissions?.find(p => p.card_id === cardId);
    if (!perm) return false;

    switch (permission) {
      case 'view': return perm.can_view || perm.can_fill || perm.can_review || perm.can_manage;
      case 'fill': return perm.can_fill || perm.can_manage;
      case 'review': return perm.can_review || perm.can_manage;
      case 'manage': return perm.can_manage;
      default: return false;
    }
  };

  const getVisibleCardIds = (): string[] | null => {
    // Only super_admin sees all cards
    if (isSuperAdmin) {
      return null;
    }

    // Otherwise, return IDs where user has ANY permission
    return permissions?.filter(p => p.can_view || p.can_fill || p.can_review || p.can_manage).map(p => p.card_id) || [];
  };

  return {
    permissions,
    isLoading,
    isSuperAdmin,
    hasCardPermission,
    getVisibleCardIds,
  };
}
