import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';

// Default role permissions (fallback when no DB override exists)
const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'], // all permissions
  manager: [
    'guests.view', 'guests.create', 'guests.edit', 'guests.export', 'guests.view_financial', 'guests.change_tier',
    'stays.checkin', 'stays.checkout', 'stays.view_all',
    'billing.view', 'billing.create_charge', 'billing.record_payment', 'billing.apply_discount', 'billing.void_invoice',
    'expenses.view', 'expenses.create', 'expenses.approve',
    'reports.view_daily', 'reports.view_financial', 'reports.export',
    'restaurant.view_orders', 'restaurant.manage_menu', 'restaurant.manage_orders',
    'settings.view', 'settings.edit', 'settings.manage_staff',
    'data.export_all', 'data.view_audit_log',
  ],
  receptionist: [
    'guests.view', 'guests.create', 'guests.edit',
    'stays.checkin', 'stays.checkout', 'stays.view_all',
    'billing.view', 'billing.create_charge', 'billing.record_payment',
    'expenses.view', 'expenses.create',
    'reports.view_daily',
    'restaurant.view_orders', 'restaurant.manage_orders',
  ],
  accountant: [
    'guests.view', 'guests.view_financial',
    'stays.view_all',
    'billing.view', 'billing.record_payment',
    'expenses.view', 'expenses.create', 'expenses.approve',
    'reports.view_daily', 'reports.view_financial', 'reports.export',
    'data.export_all',
  ],
  restaurant: [
    'restaurant.view_orders', 'restaurant.manage_orders',
  ],
  kitchen: [
    'restaurant.view_orders',
  ],
  housekeeping: [],
};

export const PERMISSIONS: Record<string, string> = {
  'guests.view': 'Voir les clients',
  'guests.create': 'Créer des clients',
  'guests.edit': 'Modifier les clients',
  'guests.delete': 'Supprimer les clients',
  'guests.export': 'Exporter les clients',
  'guests.view_financial': 'Voir les infos financières des clients',
  'guests.change_tier': 'Changer le niveau client',
  'stays.checkin': 'Effectuer un check-in',
  'stays.checkout': 'Effectuer un check-out',
  'stays.view_all': 'Voir tous les séjours',
  'billing.view': 'Voir la facturation',
  'billing.create_charge': 'Ajouter des charges',
  'billing.record_payment': 'Enregistrer des paiements',
  'billing.apply_discount': 'Appliquer des remises',
  'billing.void_invoice': 'Annuler une facture',
  'expenses.view': 'Voir les dépenses',
  'expenses.create': 'Créer des dépenses',
  'expenses.approve': 'Approuver les dépenses',
  'reports.view_daily': 'Voir les rapports journaliers',
  'reports.view_financial': 'Voir les rapports financiers',
  'reports.export': 'Exporter les rapports',
  'restaurant.view_orders': 'Voir les commandes',
  'restaurant.manage_menu': 'Gérer le menu',
  'restaurant.manage_orders': 'Gérer les commandes',
  'settings.view': 'Voir les paramètres',
  'settings.edit': 'Modifier les paramètres',
  'settings.manage_staff': 'Gérer le personnel',
  'data.export_all': 'Exporter toutes les données',
  "data.view_audit_log": "Voir le journal d'audit",
};

export const PERMISSION_CATEGORIES: Record<string, string[]> = {
  'Clients': ['guests.view','guests.create','guests.edit','guests.delete','guests.export','guests.view_financial','guests.change_tier'],
  'Séjours': ['stays.checkin','stays.checkout','stays.view_all'],
  'Facturation': ['billing.view','billing.create_charge','billing.record_payment','billing.apply_discount','billing.void_invoice'],
  'Dépenses': ['expenses.view','expenses.create','expenses.approve'],
  'Rapports': ['reports.view_daily','reports.view_financial','reports.export'],
  'Restaurant': ['restaurant.view_orders','restaurant.manage_menu','restaurant.manage_orders'],
  'Paramètres': ['settings.view','settings.edit','settings.manage_staff'],
  'Données': ['data.export_all','data.view_audit_log'],
};

function getDefaultPermission(role: string, permission: string): boolean {
  if (role === 'admin') return true;
  const allowed = DEFAULT_PERMISSIONS[role] || [];
  return allowed.includes(permission);
}

export function usePermission(permission: string): boolean {
  const { profile } = useAuth();
  const { hotel } = useHotel();

  const { data: dbPermissions } = useQuery({
    queryKey: ['permissions-overrides', profile?.id, hotel?.id, profile?.role],
    queryFn: async () => {
      if (!hotel?.id || !profile?.role) return [];
      const { data: roleData } = await supabase
        .from('role_permissions' as any)
        .select('permission, granted')
        .eq('hotel_id', hotel.id)
        .eq('role', profile.role);

      const { data: userData } = await supabase
        .from('user_permissions' as any)
        .select('permission, granted')
        .eq('hotel_id', hotel.id)
        .eq('user_id', profile.id);

      return {
        rolePermissions: roleData || [],
        userPermissions: userData || [],
      };
    },
    enabled: !!hotel?.id && !!profile?.role,
    staleTime: 5 * 60 * 1000,
  });

  if (!profile) return false;
  if (profile.is_super_admin || profile.role === 'admin') return true;

  // Precedence: user override > role override > default role map
  const userOverride = (dbPermissions as any)?.userPermissions?.find((p: any) => p.permission === permission);
  if (userOverride !== undefined) return !!userOverride?.granted;

  const roleOverride = (dbPermissions as any)?.rolePermissions?.find((p: any) => p.permission === permission);
  if (roleOverride !== undefined) return !!roleOverride?.granted;

  return getDefaultPermission(profile.role || '', permission);
}
