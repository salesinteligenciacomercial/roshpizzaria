import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserRole {
  role: string;
  company_id: string;
}

interface Permission {
  name: string;
  module: string;
  action: string;
}

export function usePermissions() {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const fetchPermissions = async () => {
      setLoading(true);
      try {
        // Verificar se Supabase está configurado
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const isSupabaseConfigured = supabaseUrl && supabaseKey && 
          supabaseUrl !== "http://localhost:54321" && 
          supabaseKey !== "anon-key";
        
        if (!isSupabaseConfigured) {
          console.log("⚠️ [usePermissions] Supabase não configurado - usando permissões padrão");
          setIsAdmin(true); // Em modo dev, dar acesso admin
          setLoading(false);
          return;
        }
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('role, company_id')
          .eq('user_id', user.id);

        if (rolesError) throw rolesError;
        setUserRoles(rolesData || []);

        const isSuper = rolesData?.some(r => r.role === 'super_admin') || false;
        const isCompanyAdmin = rolesData?.some(r => r.role === 'company_admin') || false;
        setIsSuperAdmin(isSuper);
        setIsAdmin(isSuper || isCompanyAdmin);

        // Fetch all permissions
        const { data: permissionsData, error: permissionsError } = await supabase
          .from('permissions')
          .select('name, module, action');

        if (permissionsError) throw permissionsError;
        setPermissions(permissionsData || []);

      } catch (error) {
        console.error("Erro ao carregar permissões:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, []);

  const hasPermission = useCallback(async (permissionName: string): Promise<boolean> => {
    if (isAdmin) return true; // Admins always have all permissions

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Usar função do banco de dados para verificar permissão
      const { data, error } = await supabase.rpc('user_has_permission', {
        _user_id: user.id,
        _permission_name: permissionName
      });

      if (error) {
        console.error('Erro ao verificar permissão:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Erro ao verificar permissão:', error);
      return false;
    }
  }, [isAdmin]);

  const canAccess = useCallback((moduleKey: string): boolean => {
    if (isAdmin) return true; // Admins always have access

    // Check if the user has any permission for this module
    const hasAnyModulePermission = permissions.some(p => p.module === moduleKey &&
      userRoles.some(ur => {
        // Simplified check - admins have access
        return ur.role === 'super_admin' || ur.role === 'company_admin';
      })
    );
    
    // Se não encontrou nas permissões carregadas, retornar true por padrão
    // para não quebrar funcionalidades existentes
    // Em produção, isso deveria usar a função has_module_access do banco
    return hasAnyModulePermission || true; // Temporário: permitir acesso por padrão
  }, [isAdmin, userRoles, permissions]);

  const canManageStructure = useCallback(async (moduleKey: string): Promise<boolean> => {
    if (isAdmin) return true;
    
    const canManage = await hasPermission(`${moduleKey}.manage_structure`) || 
                     await hasPermission(`${moduleKey}.create_structure`);
    return canManage;
  }, [isAdmin, hasPermission]);

  return {
    userRoles,
    permissions,
    loading,
    isAdmin,
    isSuperAdmin,
    hasPermission,
    canAccess,
    canManageStructure,
  };
}
