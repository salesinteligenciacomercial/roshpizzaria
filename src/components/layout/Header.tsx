import { Bell, Building2, PanelLeftClose, PanelLeft, MessageSquare, Instagram, Zap, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

export function Header({ onToggleSidebar, sidebarCollapsed }: HeaderProps) {
  const [userName, setUserName] = useState("Usuário");
  const [companyName, setCompanyName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const location = useLocation();

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
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      
      if (profile?.full_name) {
        setUserName(profile.full_name);
      }

      // Get company info
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id, companies(name)")
        .eq("user_id", user.id)
        .single();

      if (userRole?.companies) {
        setCompanyName((userRole.companies as any).name);
      }
    }
    setLoading(false);
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

          <div className="flex items-center gap-3 pl-3 border-l border-border/40">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-foreground">{userName}</p>
              <p className="text-xs text-muted-foreground">Administrador</p>
            </div>
            <Avatar className="h-9 w-9 ring-2 ring-primary/10 hover:ring-primary/30 transition-all cursor-pointer">
              <AvatarFallback className="bg-gradient-primary text-primary-foreground text-sm font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>
    </header>
  );
}
