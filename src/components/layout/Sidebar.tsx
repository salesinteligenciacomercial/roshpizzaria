import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  Calendar, 
  Bot, 
  Settings,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";

const navigation = [
  { name: "Analytics", href: "/analytics", icon: LayoutDashboard },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Funil de Vendas", href: "/kanban", icon: LayoutDashboard },
  { name: "Conversas", href: "/conversas", icon: MessageSquare },
  { name: "Agenda", href: "/agenda", icon: Calendar },
  { name: "Tarefas", href: "/tarefas", icon: Calendar },
  { name: "Fluxos e Automação", href: "/ia", icon: Bot },
  { name: "Configurações", href: "/configuracoes", icon: Settings },
];

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isMobile, setIsMobile] = useState(false);

  // Detectar se é mobile e colapsar automaticamente
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao sair",
        description: error.message,
      });
    } else {
      navigate("/auth");
    }
  };

  // No mobile, sempre mostrar colapsado ou usar drawer
  const effectiveCollapsed = isMobile || collapsed;

  return (
    <div 
      className={`flex h-screen flex-col bg-sidebar border-r border-sidebar-border shadow-xl transition-all duration-300 ease-in-out ${
        effectiveCollapsed ? "w-20" : "w-64"
      } ${isMobile ? "fixed left-0 top-0 z-50" : ""}`}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-center px-3 border-b border-sidebar-border/50">
        {effectiveCollapsed ? (
          <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-white font-bold text-xl">C</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <div>
              <span className="text-sidebar-foreground font-bold text-lg block leading-tight">CEUSIA</span>
              <span className="text-sidebar-foreground/60 text-xs">CRM & Automação</span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <TooltipProvider delayDuration={0}>
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navigation.map((item) => (
            <Tooltip key={item.name}>
              <TooltipTrigger asChild>
                <NavLink
                  to={item.href}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-1"
                    } ${effectiveCollapsed ? "justify-center" : ""}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className={`p-1.5 rounded-lg transition-colors ${
                        isActive 
                          ? "bg-white/20" 
                          : "bg-sidebar-accent/30 group-hover:bg-sidebar-accent"
                      }`}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      {!effectiveCollapsed && <span className="flex-1">{item.name}</span>}
                    </>
                  )}
                </NavLink>
              </TooltipTrigger>
              {effectiveCollapsed && (
                <TooltipContent side="right" className="font-medium">
                  {item.name}
                </TooltipContent>
              )}
            </Tooltip>
          ))}
        </nav>
      </TooltipProvider>

      {/* Footer */}
      <div className="border-t border-sidebar-border/50 p-4">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={`w-full text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive transition-all duration-200 group ${
                  effectiveCollapsed ? "justify-center px-0" : "justify-start"
                }`}
                onClick={handleLogout}
              >
                <div className="p-1.5 rounded-lg bg-sidebar-accent/30 group-hover:bg-destructive/30 transition-colors">
                  <LogOut className="h-4 w-4" />
                </div>
                {!effectiveCollapsed && <span className="font-medium ml-3">Sair do Sistema</span>}
              </Button>
            </TooltipTrigger>
            {effectiveCollapsed && (
              <TooltipContent side="right" className="font-medium">
                Sair do Sistema
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
