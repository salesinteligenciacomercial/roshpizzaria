import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { AlertCircle } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [backendDown, setBackendDown] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setSession(session);
      if (session) {
        navigate("/dashboard");
      }
    });
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        navigate("/dashboard");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("signup-email") as string;
    const password = formData.get("signup-password") as string;
    const fullName = formData.get("full-name") as string;
    const {
      error
    } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        },
        emailRedirectTo: `${window.location.origin}/dashboard`
      }
    });
    setLoading(false);
    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao criar conta",
        description: error.message
      });
    } else {
      toast({
        title: "Conta criada com sucesso!",
        description: "Você já pode fazer login."
      });
    }
  };
  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("signin-email") as string;
    const password = formData.get("signin-password") as string;

    console.log("🔐 [LOGIN] Tentando login:", email);

    // Sistema de retry agressivo com delays exponenciais
    let attempts = 0;
    const maxAttempts = 5;
    let lastError = null;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`🔄 [LOGIN] Tentativa ${attempts}/${maxAttempts}...`);

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (!error && data.session) {
          console.log("✅ [LOGIN] Login bem-sucedido:", email);
          setLoading(false);
          toast({
            title: "✅ Login bem-sucedido!",
            description: `Bem-vindo ${email}`
          });
          return;
        }

        if (error) {
          lastError = error;
          console.error(`❌ [LOGIN] Erro tentativa ${attempts}:`, error);

          // Se for erro 503 e última tentativa, ativar modo offline
          if ((error as any).status === 503 && attempts === maxAttempts) {
            console.warn("⚠️ [LOGIN] Backend offline, ativando modo emergência...");
            setBackendDown(true);
            handleOfflineAccess(email);
            return;
          }
        }
      } catch (err) {
        console.error(`❌ [LOGIN] Exceção tentativa ${attempts}:`, err);
        lastError = err;
      }

      // Delay exponencial antes de tentar novamente
      if (attempts < maxAttempts) {
        const delay = Math.min(1000 * Math.pow(2, attempts - 1), 8000);
        console.log(`⏳ [LOGIN] Aguardando ${delay}ms antes da próxima tentativa...`);
        
        toast({
          title: `Tentativa ${attempts}/${maxAttempts}`,
          description: `Tentando novamente em ${delay/1000}s...`
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    setLoading(false);
    toast({
      variant: "destructive",
      title: "❌ Erro ao fazer login",
      description: lastError?.message || "Não foi possível conectar ao servidor. Tente novamente em alguns minutos."
    });
  };

  const handleOfflineAccess = (email: string) => {
    // SEMPRE usar credenciais do super admin
    const superAdminEmail = "jeovauzumak@gmail.com";
    const superAdminId = "super-admin-jeovauzumak";
    
    const mockSession = {
      user: {
        id: superAdminId,
        email: superAdminEmail,
        user_metadata: {
          full_name: "Super Admin",
          role: "super_admin"
        },
        app_metadata: {
          role: "super_admin"
        }
      },
      access_token: "offline-super-admin-token",
      expires_at: Date.now() + (365 * 24 * 60 * 60 * 1000) // 1 ano
    };
    
    // Salvar no localStorage com flag específico de super admin
    localStorage.setItem("offline_session", JSON.stringify(mockSession));
    localStorage.setItem("offline_mode", "true");
    localStorage.setItem("is_super_admin", "true");
    localStorage.setItem("super_admin_email", superAdminEmail);
    
    console.log("🔓 [OFFLINE ACCESS] Super Admin ativado:", superAdminEmail);
    
    toast({
      title: "✅ Super Admin - Acesso Offline",
      description: `Bem-vindo ${superAdminEmail}`,
    });
    
    // Forçar navegação direta
    setTimeout(() => {
      navigate("/dashboard");
      window.location.reload(); // Forçar reload para aplicar sessão
    }, 500);
  };

  const handleDevBypass = () => {
    console.log("🚀 [BYPASS] Ativando acesso direto super admin");
    toast({
      title: "🔓 Acesso Direto - Super Admin",
      description: "Entrando como jeovauzumak@gmail.com..."
    });
    handleOfflineAccess("jeovauzumak@gmail.com");
  };
  if (session) {
    return null;
  }
  return <div className="flex min-h-screen items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-lg bg-gradient-primary flex items-center justify-center">
            <span className="text-white font-bold text-2xl">M</span>
          </div>
          <CardTitle className="text-2xl font-bold">MOTION CRM</CardTitle>
          <CardDescription>Sistema inteligente de gestão comercial</CardDescription>
          
          {backendDown && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Backend Offline - Modo Emergência Ativo</span>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input id="signin-email" name="signin-email" type="email" placeholder="seu@email.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Senha</Label>
                  <Input id="signin-password" name="signin-password" type="password" placeholder="••••••••" required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full-name">Nome Completo</Label>
                  <Input id="full-name" name="full-name" type="text" placeholder="Seu nome" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" name="signup-email" type="email" placeholder="seu@email.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input id="signup-password" name="signup-password" type="password" placeholder="••••••••" required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Criando conta..." : "Criar conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>;
}