import { Bell, Building2, PanelLeftClose, PanelLeft, MessageSquare, Instagram, Zap, Clock, Users, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

export function Header({ onToggleSidebar, sidebarCollapsed }: HeaderProps) {
  const [userName, setUserName] = useState("Usuário");
  const [userRole, setUserRole] = useState("Usuário");
  const [companyName, setCompanyName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Métricas rápidas para página de Conversas
  const conversationsMetrics = useMemo(() => {
    try {
      const raw = localStorage.getItem("continuum_conversations");
      const list = raw ? JSON.parse(raw) : [];
      const totalConversas = Array.isArray(list) ? list.length : 0;
      const ativas = Array.isArray(list) ? list.filter((c: any) => c.status !== 'resolved').length : 0;
      const whatsapp = Array.isArray(list) ? list.filter((c: any) => c.channel === 'whatsapp').length : 0;
      const instagram = Array.isArray(list) ? list.filter((c: any) => c.channel === 'instagram').length : 0;
      const telegram = Array.isArray(list) ? list.filter((c: any) => c.channel === 'telegram').length : 0;
      const today = new Date();
      today.setHours(0,0,0,0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      let mensagensHoje = 0;
      if (Array.isArray(list)) {
        for (const conv of list) {
          const msgs = Array.isArray(conv.messages) ? conv.messages : [];
          for (const m of msgs) {
            const ts = m?.timestamp ? new Date(m.timestamp) : null;
            if (ts && ts >= today && ts < tomorrow) mensagensHoje++;
          }
        }
      }
      return { totalConversas, ativas, mensagensHoje, whatsapp, instagram, telegram };
    } catch {
      return { totalConversas: 0, ativas: 0, mensagensHoje: 0, whatsapp: 0, instagram: 0, telegram: 0 };
    }
  }, [location.pathname]);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error("❌ Erro ao obter usuário:", userError);
        await handleLogout();
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      
      if (profile?.full_name) {
        setUserName(profile.full_name);
      } else {
        setUserName(user.email || "Usuário");
      }

      // Get company info and role
      const { data: userRoleData } = await supabase
        .from("user_roles")
        .select("role, company_id, companies(name)")
        .eq("user_id", user.id)
        .single();

      if (userRoleData) {
        // Mapear role para português
        const roleMap: Record<string, string> = {
          'super_admin': 'Super Administrador',
          'admin': 'Administrador',
          'moderator': 'Moderador',
          'user': 'Usuário Padrão'
        };
        setUserRole(roleMap[userRoleData.role] || 'Usuário');
        
        if (userRoleData.companies) {
          setCompanyName((userRoleData.companies as any).name);
        }
      }
    } catch (error) {
      console.error("❌ Erro ao carregar dados do usuário:", error);
      await handleLogout();
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      console.log("🚪 Iniciando logout...");
      
      // Limpar todos os dados locais
      localStorage.clear();
      sessionStorage.clear();
      
      // Fazer logout no Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("❌ Erro no logout:", error);
        toast({
          variant: "destructive",
          title: "Erro ao sair",
          description: error.message
        });
      } else {
        console.log("✅ Logout realizado com sucesso");
        toast({
          title: "Logout realizado",
          description: "Você foi desconectado com sucesso"
        });
      }
      
      // Redirecionar para auth sempre, mesmo com erro
      navigate("/auth", { replace: true });
      
      // Forçar reload da página para limpar qualquer estado residual
      setTimeout(() => {
        window.location.href = "/auth";
      }, 100);
    } catch (error) {
      console.error("❌ Erro fatal no logout:", error);
      // Mesmo com erro, limpar tudo e redirecionar
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/auth";
    }
  };

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="flex h-16 items-center gap-4 px-6">
        {/* Toggle Sidebar Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="hover:bg-muted group transition-all"
          title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          ) : (
            <PanelLeftClose className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
        </Button>

        {/* Cards de métricas (apenas em Conversas) */}
        {location.pathname?.toLowerCase().includes("conversas") && (
          <div className="hidden lg:flex items-center gap-2 flex-1 overflow-x-auto">
            <div className="px-3 py-2 border rounded-lg bg-muted/20 whitespace-nowrap flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4" /> {conversationsMetrics.totalConversas} Conversas
            </div>
            <div className="px-3 py-2 border rounded-lg bg-muted/20 whitespace-nowrap flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" /> {conversationsMetrics.ativas} Ativas
            </div>
            <div className="px-3 py-2 border rounded-lg bg-muted/20 whitespace-nowrap flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" /> {conversationsMetrics.mensagensHoje} Hoje
            </div>
            <div className="px-3 py-2 border rounded-lg bg-muted/20 whitespace-nowrap flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-[#25D366]" /> {conversationsMetrics.whatsapp} WhatsApp
            </div>
            <div className="px-3 py-2 border rounded-lg bg-muted/20 whitespace-nowrap flex items-center gap-2 text-sm">
              <Instagram className="h-4 w-4 text-pink-500" /> {conversationsMetrics.instagram} Instagram
            </div>
            <div className="px-3 py-2 border rounded-lg bg-muted/20 whitespace-nowrap flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4" /> {conversationsMetrics.telegram} Telegram
          </div>
        </div>
        )}

        {/* Removido: busca global no topo */}

        {/* Actions */}
        <div className="flex items-center gap-3">
          {!loading && companyName && (
            <Badge variant="outline" className="flex items-center gap-2">
              <Building2 className="h-3 w-3" />
              {companyName}
            </Badge>
          )}

          <Button 
            variant="ghost" 
            size="icon" 
            className="relative hover:bg-muted group transition-all"
          >
            <Bell className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-3 pl-3 border-l border-border/40 cursor-pointer hover:bg-muted/50 rounded-lg p-2 transition-colors">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-foreground">{userName}</p>
                  <p className="text-xs text-muted-foreground">{userRole}</p>
                </div>
                <Avatar className="h-9 w-9 ring-2 ring-primary/10 hover:ring-primary/30 transition-all">
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground text-sm font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{userName}</p>
                  <p className="text-xs text-muted-foreground">{userRole}</p>
                  {companyName && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {companyName}
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/configuracoes")}>
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleLogout}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
