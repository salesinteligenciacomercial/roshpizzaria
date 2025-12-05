import { Navigate, Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { FloatingChatButton } from "@/components/internal-chat/FloatingChatButton";

export function MainLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Bypass auth se configurado OU se Supabase não estiver configurado (modo dev)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const isSupabaseConfigured = supabaseUrl && supabaseKey && 
    supabaseUrl !== "http://localhost:54321" && 
    supabaseKey !== "anon-key";
  const bypassAuth = (import.meta.env.VITE_BYPASS_AUTH === '1') || 
                     (import.meta.env.DEV === true) ||
                     !isSupabaseConfigured;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | undefined;
    let subscription: { unsubscribe: () => void } | null = null;
    
    const initAuth = async () => {
      try {
        console.log("🔐 Inicializando autenticação...");
        
        // Se Supabase não estiver configurado, pular verificação
        if (!isSupabaseConfigured) {
          console.log("⚠️ Supabase não configurado - modo desenvolvimento sem autenticação");
          setLoading(false);
          return;
        }

        // ✅ CRÍTICO: Limpar TODOS os dados antigos primeiro
        localStorage.removeItem('offline_mode');
        localStorage.removeItem('offline_session');
        localStorage.removeItem('is_super_admin');
        localStorage.removeItem('super_admin_email');

        // Timeout de segurança: se demorar mais de 5 segundos, liberar o loading
        timeoutId = setTimeout(() => {
          console.warn("⚠️ Timeout na verificação de autenticação - liberando interface");
          setLoading(false);
        }, 5000);

        // Check current session via Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        
        if (error) {
          console.error("❌ Erro ao verificar sessão:", error);
          // Em modo dev, não limpar tudo - apenas definir como null
          if (bypassAuth) {
            setSession(null);
          } else {
            // Limpar tudo em caso de erro
            localStorage.clear();
            sessionStorage.clear();
            setSession(null);
          }
        } else if (!session) {
          console.log("⚠️ Nenhuma sessão ativa encontrada");
          // Em modo dev, não limpar tudo
          if (bypassAuth) {
            setSession(null);
          } else {
            // Limpar tudo se não houver sessão
            localStorage.clear();
            sessionStorage.clear();
            setSession(null);
          }
        } else {
          console.log("✅ Sessão ativa encontrada:", session.user.email);
          setSession(session);
        }
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        console.error("❌ Erro fatal ao inicializar auth:", error);
        // Em modo dev, não limpar tudo
        if (!bypassAuth) {
          localStorage.clear();
          sessionStorage.clear();
        }
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes apenas se Supabase estiver configurado
    if (isSupabaseConfigured) {
      const {
        data: { subscription: authSubscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        console.log("🔐 Auth state changed:", _event, session?.user?.email || "sem usuário");
        
        // Se houver SIGNED_OUT ou sem sessão, limpar tudo
        if (_event === 'SIGNED_OUT' || !session) {
          if (!bypassAuth) {
            console.log("🚪 Limpando dados após logout/sem sessão");
            localStorage.clear();
            sessionStorage.clear();
          }
          setSession(null);
        } else {
          console.log("✅ Sessão atualizada:", session.user.email);
          setSession(session);
        }
      });

      subscription = authSubscription;
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (subscription) subscription.unsubscribe();
    };
  }, [isSupabaseConfigured, bypassAuth]);

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
      
      {/* Botão flutuante do chat interno da equipe */}
      {session && <FloatingChatButton />}
    </div>
  );
}
