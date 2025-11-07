import { Navigate, Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";

export function MainLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const bypassAuth = ((import.meta as any).env?.VITE_BYPASS_AUTH === '1') || ((import.meta as any).env?.DEV === true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Limpar flags antigas de modo offline
        localStorage.removeItem('offline_mode');
        localStorage.removeItem('offline_session');
        localStorage.removeItem('is_super_admin');
        localStorage.removeItem('super_admin_email');

        // Check current session via Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("❌ Erro ao verificar sessão:", error);
          // Limpar tudo em caso de erro
          localStorage.clear();
          sessionStorage.clear();
          setSession(null);
        } else {
          setSession(session);
        }
      } catch (error) {
        console.error("❌ Erro fatal ao inicializar auth:", error);
        localStorage.clear();
        sessionStorage.clear();
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("🔐 Auth state changed:", _event);
      setSession(session);
      
      // Se houver SIGNED_OUT, limpar tudo
      if (_event === 'SIGNED_OUT') {
        localStorage.clear();
        sessionStorage.clear();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session && !bypassAuth) {
    return <Navigate to="/auth" replace />;
  }

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const newValue = !prev;
      localStorage.setItem('sidebar-collapsed', String(newValue));
      return newValue;
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar collapsed={sidebarCollapsed} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
