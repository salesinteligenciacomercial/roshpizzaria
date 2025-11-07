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
export default function Auth() {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
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

    // Tentar login com retry automático
    let attempts = 0;
    const maxAttempts = 3;
    let lastError = null;

    while (attempts < maxAttempts) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (!error) {
        setLoading(false);
        return;
      }

      lastError = error;
      attempts++;

      if (attempts < maxAttempts) {
        toast({
          title: `Tentativa ${attempts}/${maxAttempts}`,
          description: "Tentando novamente..."
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setLoading(false);
    toast({
      variant: "destructive",
      title: "Erro ao fazer login",
      description: lastError?.message || "Serviço temporariamente indisponível"
    });
  };

  const handleDevBypass = () => {
    toast({
      title: "Modo Desenvolvimento",
      description: "Acessando sem autenticação..."
    });
    navigate("/dashboard");
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
                {import.meta.env.DEV && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full mt-2" 
                    onClick={handleDevBypass}
                  >
                    🔧 Pular Login (Dev Mode)
                  </Button>
                )}
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