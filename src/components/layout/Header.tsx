import { Bell, Search, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function Header() {
  const [userName, setUserName] = useState("Usuário");
  const [companyName, setCompanyName] = useState<string>("");
  const [loading, setLoading] = useState(true);

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
        {/* Search */}
        <div className="flex-1 max-w-xl">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-hover:text-primary transition-colors" />
            <Input
              placeholder="Buscar leads, conversas, tarefas..."
              className="pl-9 border-border/40 bg-muted/30 hover:bg-muted/50 focus:bg-background transition-colors"
            />
          </div>
        </div>

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
