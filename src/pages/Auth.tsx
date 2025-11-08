import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { AlertCircle, RefreshCw, ExternalLink } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [backendDown, setBackendDown] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  
  useEffect(() => {
    // ✅ CRÍTICO: Limpar TUDO ao carregar a página de login
    const cleanupOldData = async () => {
      console.log("🧹 Limpando dados antigos da página de login...");
      
      // Verificar se há sessão ativa
      const { data: { session } } = await supabase.auth.getSession();
      
      // Se não houver sessão, limpar tudo
      if (!session) {
        console.log("🗑️ Nenhuma sessão ativa, limpando localStorage/sessionStorage");
        localStorage.clear();
        sessionStorage.clear();
      } else {
        console.log("✅ Sessão ativa encontrada, redirecionando...");
        // Se há sessão, redirecionar para dashboard
        setTimeout(() => {
          navigate("/dashboard");
        }, 0);
      }
    };
    
    cleanupOldData();
    
    // ✅ CRÍTICO: Configurar listener ANTES de verificar sessão existente
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🔐 Auth state changed:', _event, !!session);
      setSession(session);
      
      // ✅ CRÍTICO: Usar setTimeout(0) para evitar deadlock
      if (session) {
        setTimeout(() => {
          console.log('✅ Navegando para dashboard após auth state change');
          navigate("/dashboard");
        }, 0);
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
  const checkBackendStatus = async () => {
    setCheckingStatus(true);
    try {
      const { error } = await supabase.auth.getSession();
      if (error && (error as any).status === 503) {
        setBackendDown(true);
      } else {
        setBackendDown(false);
        toast({
          title: "Backend online!",
          description: "O servidor está respondendo. Tente fazer login novamente."
        });
      }
    } catch (err) {
      setBackendDown(true);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setBackendDown(false);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get("signin-email") as string;
    const password = formData.get("signin-password") as string;

    console.log("🔐 Tentando login:", email);

    try {
      // Login direto usando Supabase Auth (para todos os usuários, inclusive super admin)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error("❌ Erro ao fazer login:", error);
        
        // Verificar se é erro 503 (backend fora do ar)
        if ((error as any).status === 503 || error.message.includes("503")) {
          setBackendDown(true);
          toast({
            variant: "destructive",
            title: "🔴 Backend fora do ar",
            description: "O servidor de autenticação está indisponível. Aguarde alguns minutos."
          });
          setLoading(false);
          return;
        }
        
        // Verificar outros erros
        if (error.message.includes("upstream") || error.message.includes("connect")) {
          setBackendDown(true);
          toast({
            variant: "destructive",
            title: "Erro de conexão com servidor",
            description: "Não foi possível conectar ao backend. Verifique o status abaixo."
          });
        } else if (error.message.includes("Invalid login credentials")) {
          toast({
            variant: "destructive",
            title: "Credenciais inválidas",
            description: "Email ou senha incorretos. Verifique suas credenciais."
          });
        } else {
          toast({
            variant: "destructive",
            title: "Erro ao fazer login",
            description: error.message
          });
        }
        setLoading(false);
        return;
      }

      if (data.session) {
        console.log("✅ Login bem-sucedido:", email);
        setBackendDown(false);
        
        // Verificar se é super admin
        const isSuperAdmin = email === "jeovauzumak@gmail.com";
        
        toast({
          title: "Login bem-sucedido!",
          description: isSuperAdmin ? "Bem-vindo Super Admin!" : "Bem-vindo de volta!"
        });
        
        // ✅ A navegação será feita automaticamente pelo onAuthStateChange
        // Não precisa navegar aqui para evitar navegação duplicada
      }
    } catch (err: any) {
      console.error("❌ Exceção ao fazer login:", err);
      
      // Verificar se é erro 503
      if (err.status === 503) {
        setBackendDown(true);
        toast({
          variant: "destructive",
          title: "Backend fora do ar",
          description: "O servidor não está respondendo (erro 503)."
        });
      } else if (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError")) {
        toast({
          variant: "destructive",
          title: "Erro de conexão",
          description: "Não foi possível conectar ao servidor."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao fazer login",
          description: err.message || "Erro desconhecido. Tente novamente."
        });
      }
    } finally {
      setLoading(false);
    }
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
        </CardHeader>
        <CardContent>
          {backendDown && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Backend Indisponível (503)</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>O servidor de autenticação está temporariamente fora do ar.</p>
                <div className="flex gap-2 mt-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={checkBackendStatus}
                    disabled={checkingStatus}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`h-3 w-3 ${checkingStatus ? 'animate-spin' : ''}`} />
                    {checkingStatus ? 'Verificando...' : 'Verificar Status'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.open('https://status.supabase.com', '_blank')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Status Supabase
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input 
                    id="signin-email" 
                    name="signin-email" 
                    type="email" 
                    placeholder="seu@email.com" 
                    required 
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Senha</Label>
                  <Input 
                    id="signin-password" 
                    name="signin-password" 
                    type="password" 
                    placeholder="••••••••" 
                    required 
                    autoComplete="current-password"
                  />
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