import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Key, 
  Webhook, 
  Users, 
  Upload, 
  Bot,
  MessageSquare,
  Mic,
  UserPlus,
  Trash2,
  Building2,
  Shield
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { WhatsAppQRCode } from "@/components/configuracoes/WhatsAppQRCode";
import { SubcontasManager } from "@/components/configuracoes/SubcontasManager";
import { supabase } from "@/integrations/supabase/client";

interface Colaborador {
  id: string;
  nome: string;
  email: string;
  setor: string;
  funcao: string;
  atendimentosAtivos: number;
  capacidadeMaxima: number;
  status: "disponivel" | "ocupado" | "ausente";
}

export default function Configuracoes() {
  const { toast } = useToast();
  const [openaiKey, setOpenaiKey] = useState("");
  const [audimaToken, setAudimaToken] = useState("");
  const [elevenlabsKey, setElevenlabsKey] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const hasSuperAdmin = roles?.some(r => r.role === 'super_admin');
      setIsSuperAdmin(hasSuperAdmin || false);
    } catch (error) {
      console.error('Erro ao verificar role:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Estados para Fila de Atendimento
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([
    {
      id: "1",
      nome: "Ana Costa",
      email: "ana@example.com",
      setor: "Atendimento",
      funcao: "Atendente",
      atendimentosAtivos: 5,
      capacidadeMaxima: 10,
      status: "disponivel",
    },
    {
      id: "2",
      nome: "Pedro Lima",
      email: "pedro@example.com",
      setor: "Vendas",
      funcao: "Vendedor",
      atendimentosAtivos: 8,
      capacidadeMaxima: 10,
      status: "ocupado",
    },
  ]);
  const [novoColaborador, setNovoColaborador] = useState({
    nome: "",
    email: "",
    setor: "",
    funcao: "",
    capacidadeMaxima: 10,
  });

  const handleSaveToken = (integration: string) => {
    toast({
      title: "Token salvo",
      description: `Token de ${integration} salvo com sucesso`,
    });
  };

  const adicionarColaborador = () => {
    if (!novoColaborador.nome || !novoColaborador.email || !novoColaborador.setor) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
      });
      return;
    }

    const novo: Colaborador = {
      id: Date.now().toString(),
      nome: novoColaborador.nome,
      email: novoColaborador.email,
      setor: novoColaborador.setor,
      funcao: novoColaborador.funcao,
      atendimentosAtivos: 0,
      capacidadeMaxima: novoColaborador.capacidadeMaxima,
      status: "disponivel",
    };

    setColaboradores([...colaboradores, novo]);
    setNovoColaborador({
      nome: "",
      email: "",
      setor: "",
      funcao: "",
      capacidadeMaxima: 10,
    });
    toast({
      title: "Sucesso",
      description: "Colaborador adicionado com sucesso!",
    });
  };

  const removerColaborador = (id: string) => {
    setColaboradores(colaboradores.filter((c) => c.id !== id));
    toast({
      title: "Colaborador removido",
    });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      disponivel: "default",
      ocupado: "destructive",
      ausente: "secondary",
    };
    const labels = {
      disponivel: "Disponível",
      ocupado: "Ocupado",
      ausente: "Ausente",
    };
    return (
      <Badge variant={variants[status as keyof typeof variants] as any}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const defaultTab = isSuperAdmin ? "subcontas" : "fila";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie integrações, tokens e configurações do sistema
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className={`grid w-full ${isSuperAdmin ? 'grid-cols-6' : 'grid-cols-5'}`}>
          {isSuperAdmin && (
            <TabsTrigger value="subcontas">
              <Building2 className="mr-2 h-4 w-4" />
              Subcontas
            </TabsTrigger>
          )}
          <TabsTrigger value="fila">Fila de Atendimento</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="tokens">Tokens de IA</TabsTrigger>
          <TabsTrigger value="permissoes">
            <Shield className="mr-2 h-4 w-4" />
            Permissões
          </TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        {isSuperAdmin && (
          <TabsContent value="subcontas">
            <SubcontasManager />
          </TabsContent>
        )}

        <TabsContent value="fila" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Adicionar Colaborador</CardTitle>
              <CardDescription>
                Configure os colaboradores e seus setores de atendimento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      placeholder="Nome completo"
                      value={novoColaborador.nome}
                      onChange={(e) =>
                        setNovoColaborador({ ...novoColaborador, nome: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="email@example.com"
                      value={novoColaborador.email}
                      onChange={(e) =>
                        setNovoColaborador({ ...novoColaborador, email: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="setor">Setor *</Label>
                    <Select
                      value={novoColaborador.setor}
                      onValueChange={(value) =>
                        setNovoColaborador({ ...novoColaborador, setor: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Atendimento">Atendimento</SelectItem>
                        <SelectItem value="Vendas">Vendas</SelectItem>
                        <SelectItem value="Financeiro">Financeiro</SelectItem>
                        <SelectItem value="Suporte">Suporte</SelectItem>
                        <SelectItem value="Administrativo">Administrativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="funcao">Função</Label>
                    <Input
                      id="funcao"
                      placeholder="Ex: Atendente, Vendedor"
                      value={novoColaborador.funcao}
                      onChange={(e) =>
                        setNovoColaborador({ ...novoColaborador, funcao: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="capacidade">Capacidade Máxima</Label>
                    <Input
                      id="capacidade"
                      type="number"
                      min="1"
                      max="50"
                      value={novoColaborador.capacidadeMaxima}
                      onChange={(e) =>
                        setNovoColaborador({
                          ...novoColaborador,
                          capacidadeMaxima: parseInt(e.target.value) || 10,
                        })
                      }
                    />
                  </div>
                </div>

                <Button onClick={adicionarColaborador} className="w-full">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Adicionar Colaborador
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Colaboradores Ativos</CardTitle>
              <CardDescription>
                Lista de colaboradores e suas cargas de trabalho
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {colaboradores.map((colaborador) => (
                  <div
                    key={colaborador.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <h4 className="font-semibold">{colaborador.nome}</h4>
                          <p className="text-sm text-muted-foreground">{colaborador.email}</p>
                        </div>
                        {getStatusBadge(colaborador.status)}
                      </div>
                      <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                        <span>
                          <strong>Setor:</strong> {colaborador.setor}
                        </span>
                        <span>
                          <strong>Função:</strong> {colaborador.funcao || "—"}
                        </span>
                        <span>
                          <strong>Atendimentos:</strong> {colaborador.atendimentosAtivos}/
                          {colaborador.capacidadeMaxima}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => removerColaborador(colaborador.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {colaboradores.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum colaborador cadastrado ainda</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <WhatsAppQRCode />

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-purple-500" />
                  Instagram
                </CardTitle>
                <CardDescription>Conecte sua conta comercial do Instagram</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full">
                  Conectar com Facebook
                </Button>
                <p className="text-sm text-muted-foreground">
                  Integração em desenvolvimento
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
                  Facebook Messenger
                </CardTitle>
                <CardDescription>Conecte sua página do Facebook</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full">
                  Conectar com Facebook
                </Button>
                <p className="text-sm text-muted-foreground">
                  Integração em desenvolvimento
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-cyan-500" />
                  Telegram
                </CardTitle>
                <CardDescription>Conecte seu bot do Telegram</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Token do Bot</Label>
                  <Input placeholder="Cole o token do BotFather" />
                </div>
                <Button className="w-full">Conectar Telegram</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tokens" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                OpenAI (GPT)
              </CardTitle>
              <CardDescription>
                Configure sua chave da API OpenAI para usar GPT-4 e GPT-5
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Chave da API</Label>
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                />
              </div>
              <Button onClick={() => handleSaveToken("OpenAI")}>
                <Key className="mr-2 h-4 w-4" />
                Salvar Token
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-primary" />
                Audima (Text-to-Speech)
              </CardTitle>
              <CardDescription>
                Configure sua conta Audima para conversão de texto em áudio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Token de Acesso</Label>
                <Input
                  type="password"
                  placeholder="Cole seu token Audima"
                  value={audimaToken}
                  onChange={(e) => setAudimaToken(e.target.value)}
                />
              </div>
              <Button onClick={() => handleSaveToken("Audima")}>
                <Key className="mr-2 h-4 w-4" />
                Salvar Token
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-primary" />
                ElevenLabs (Voz Neural)
              </CardTitle>
              <CardDescription>
                Configure ElevenLabs para geração de áudio com IA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Chave da API</Label>
                <Input
                  type="password"
                  placeholder="Cole sua chave ElevenLabs"
                  value={elevenlabsKey}
                  onChange={(e) => setElevenlabsKey(e.target.value)}
                />
              </div>
              <Button onClick={() => handleSaveToken("ElevenLabs")}>
                <Key className="mr-2 h-4 w-4" />
                Salvar Token
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissoes">
          <Card>
            <CardHeader>
              <CardTitle>Permissões e Perfis</CardTitle>
              <CardDescription>
                Configure permissões por perfil de usuário
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  As permissões são gerenciadas através dos perfis de usuário:
                </p>
                <div className="grid gap-4">
                  <div className="rounded-md border p-4">
                    <h4 className="font-medium mb-2">Super Admin</h4>
                    <p className="text-sm text-muted-foreground">
                      Acesso total ao sistema, incluindo gestão de subcontas
                    </p>
                  </div>
                  <div className="rounded-md border p-4">
                    <h4 className="font-medium mb-2">Administrador</h4>
                    <p className="text-sm text-muted-foreground">
                      Acesso total à sua empresa e gestão de usuários
                    </p>
                  </div>
                  <div className="rounded-md border p-4">
                    <h4 className="font-medium mb-2">Gestor</h4>
                    <p className="text-sm text-muted-foreground">
                      Acesso a relatórios, leads, funis e conversas
                    </p>
                  </div>
                  <div className="rounded-md border p-4">
                    <h4 className="font-medium mb-2">Vendedor</h4>
                    <p className="text-sm text-muted-foreground">
                      Acesso a leads, conversas e tarefas
                    </p>
                  </div>
                  <div className="rounded-md border p-4">
                    <h4 className="font-medium mb-2">Suporte</h4>
                    <p className="text-sm text-muted-foreground">
                      Acesso a conversas e agenda
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhooks e API
              </CardTitle>
              <CardDescription>
                Configure webhooks para integração com sistemas externos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Novo Webhook
                </Button>
                <div className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">Nenhum webhook configurado</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
