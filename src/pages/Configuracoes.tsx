import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Pencil,
  Plus,
  UserCog
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { WhatsAppQRCode } from "@/components/configuracoes/WhatsAppQRCode";
import { SubcontasManager } from "@/components/configuracoes/SubcontasManager";
import { UsuariosSubcontaDialog } from "@/components/configuracoes/UsuariosSubcontaDialog";
import { supabase } from "@/integrations/supabase/client";
import { FilaDialog } from "@/components/configuracoes/FilaDialog";
import { FilaColaboradoresDialog } from "@/components/configuracoes/FilaColaboradoresDialog";

interface Colaborador {
  id: string; // user_roles.id
  userId?: string; // profiles.id
  nome: string;
  email: string;
  setor?: string;
  funcao?: string;
  atendimentosAtivos: number;
  capacidadeMaxima: number;
  status: "disponivel" | "ocupado" | "ausente";
}

export default function Configuracoes() {
  const { toast } = useToast();
  const [openaiKey, setOpenaiKey] = useState("");
  const [audimaToken, setAudimaToken] = useState("");
  const [elevenlabsKey, setElevenlabsKey] = useState("");
  const [isMasterAccount, setIsMasterAccount] = useState(false);
  const [isSubAccount, setIsSubAccount] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentCompany, setCurrentCompany] = useState<any | null>(null);
  const [manageUsersOpen, setManageUsersOpen] = useState(false);
  const [latestAnnouncement, setLatestAnnouncement] = useState<any | null>(null);
  
  const hasRole = (role: string) => userRoles.includes(role);

  useEffect(() => {
    checkAccessAndRoles();
  }, []);

  const checkAccessAndRoles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      // Buscar todas as associações do usuário (pode pertencer a múltiplas empresas)
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role, company_id, created_at')
        .eq('user_id', user.id);

      const roleList = (roles || []).map(r => r.role).filter(Boolean);
      setUserRoles(Array.from(new Set(roleList)));

      const companyIds = Array.from(new Set((roles || []).map(r => r.company_id).filter(Boolean)));
      if (companyIds.length > 0) {
        const { data: companies } = await (supabase as any)
          .from('companies')
          .select('id, name, plan, is_master_account, parent_company_id')
          .in('id', companyIds as any);

        // Empresa atual padrão: prioriza master; senão, usa a mais recente do user_roles
        const latestRole = (roles || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        const preferred = (companies || []).find((c: any) => c.is_master_account) || (companies || []).find((c: any) => c.id === latestRole?.company_id) || null;
        setCurrentCompany(preferred || null);

        // 🔒 SEGURANÇA: Verificar se a empresa atual é subconta
        const isCurrentSubAccount = preferred?.parent_company_id !== null && preferred?.parent_company_id !== undefined;
        setIsSubAccount(isCurrentSubAccount);

        // 🔒 SEGURANÇA: Apenas mostrar opções de master se NÃO for subconta E for master account
        const canAccessMasterFeatures = !isCurrentSubAccount && preferred?.is_master_account === true;
        setIsMasterAccount(canAccessMasterFeatures);
      } else {
        setIsMasterAccount(false);
        setIsSubAccount(false);
        setCurrentCompany(null);
      }
    } catch (error) {
      console.error('Erro ao verificar role:', error);
    } finally {
      setLoading(false);
    }
  };

  // Carregar último aviso publicado (geral ou por empresa)
  useEffect(() => {
    const loadAnnouncement = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        // company_id pode ser definido após checkAccessAndRoles; aguardamos currentCompany
        const companyId = currentCompany?.id;
        let query = (supabase as any)
          .from('announcements')
          .select('*')
          .eq('published', true)
          .order('created_at', { ascending: false })
          .limit(1);

        if (companyId) {
          // Buscar primeiro por avisos da empresa e gerais (company_id is null)
          query = (supabase as any)
            .from('announcements')
            .select('*')
            .eq('published', true)
            .or(`company_id.is.null,company_id.eq.${companyId}`)
            .order('created_at', { ascending: false })
            .limit(1);
        }

        const { data, error } = await query;
        if (error) throw error;
        setLatestAnnouncement((data && data.length > 0) ? data[0] : null);
      } catch (e: any) {
        // Ignorar erro se a tabela não existir
        if (e?.message?.includes('announcements')) {
          // Tabela não existe, não é crítico
          return;
        }
        console.error('Erro ao carregar avisos:', e?.message || e);
      }
    };
    loadAnnouncement();
  }, [currentCompany?.id]);
  
  // Estados para Fila de Atendimento
  const [filas, setFilas] = useState<any[]>([]);
  const [filasLoading, setFilasLoading] = useState<boolean>(false);
  const [filaDialogOpen, setFilaDialogOpen] = useState<boolean>(false);
  const [editingFila, setEditingFila] = useState<any | null>(null);
  const [colaboradoresDialogOpen, setColaboradoresDialogOpen] = useState<boolean>(false);
  const [filaSelecionada, setFilaSelecionada] = useState<any | null>(null);

  const carregarFilas = async () => {
    try {
      setFilasLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFilas([]);
        return;
      }

      // Tentar buscar por company_id primeiro (estrutura nova)
      let data, error;
      const companyId = currentCompany?.id;
      
      if (companyId) {
        // Tentar com company_id primeiro
        // @ts-ignore - Tipos complexos do Supabase causando erro de inferência
        const resultCompany = await supabase
          .from('filas_atendimento')
          .select('*')
          .eq('company_id', companyId)
          .order('prioridade', { ascending: true });
        
        // Se der erro de coluna não encontrada, tentar com owner_id
        if (resultCompany.error && resultCompany.error.message?.includes('company_id')) {
          const resultOwner = await supabase
            .from('filas_atendimento')
            .select('*')
            .eq('owner_id', user.id)
            .order('prioridade', { ascending: true });
          
          data = resultOwner.data;
          error = resultOwner.error;
        } else {
          data = resultCompany.data;
          error = resultCompany.error;
        }
      } else {
        // Fallback: buscar por owner_id (estrutura antiga)
        const result = await supabase
          .from('filas_atendimento')
          .select('*')
          .eq('owner_id', user.id)
          .order('prioridade', { ascending: true });
        
        data = result.data;
        error = result.error;
      }

      if (error) throw error;
      setFilas(data || []);
    } catch (e: any) {
      console.error('Erro ao carregar filas:', e?.message || e);
      console.error('Detalhes do erro:', JSON.stringify(e, null, 2));
      toast({
        variant: "destructive",
        title: "Erro ao carregar filas",
        description: e?.message || "Não foi possível carregar as filas de atendimento.",
      });
      setFilas([]);
    } finally {
      setFilasLoading(false);
    }
  };

  useEffect(() => {
    if (currentCompany?.id) {
      carregarFilas();
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    carregarColaboradores();
  }, [currentCompany?.id]);

  const abrirNovaFila = () => {
    setEditingFila(null);
    setFilaDialogOpen(true);
  };

  const abrirEditarFila = (fila: any) => {
    setEditingFila(fila);
    setFilaDialogOpen(true);
  };

  const abrirGerenciarColaboradores = (fila: any) => {
    setFilaSelecionada(fila);
    setColaboradoresDialogOpen(true);
  };

  const fecharFilaDialog = (open: boolean) => {
    setFilaDialogOpen(open);
    if (!open) {
      setEditingFila(null);
    }
  };

  const fecharColaboradoresDialog = (open: boolean) => {
    setColaboradoresDialogOpen(open);
    if (!open) {
      setFilaSelecionada(null);
    }
  };

  const removerFila = async (id: string) => {
    try {
      const { error } = await (supabase as any).from('filas_atendimento').delete().eq('id', id);
      if (error) throw error;
      await carregarFilas();
      toast({ title: 'Fila removida' });
    } catch (e) {
      console.error('Erro ao remover fila:', e);
      toast({ variant: 'destructive', title: 'Erro ao remover fila' });
    }
  };

  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [novoColaborador, setNovoColaborador] = useState({
    nome: "",
    email: "",
    setor: "",
    funcao: "",
    capacidadeMaxima: 10,
  });

  const carregarColaboradores = async () => {
    try {
      const companyId = currentCompany?.id;
      if (!companyId) {
        setColaboradores([]);
        return;
      }
      
      // Buscar user_roles primeiro
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('id, user_id, role')
        .eq('company_id', companyId);
        
      if (rolesError) throw rolesError;
      
      if (!userRoles || userRoles.length === 0) {
        setColaboradores([]);
        return;
      }

      // Buscar profiles separadamente
      const userIds = userRoles.map((ur: any) => ur.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Combinar dados
      const mapped: Colaborador[] = (userRoles || []).map((u: any) => {
        const profile = (profilesData || []).find((p: any) => p.id === u.user_id);
        return {
          id: u.id,
          userId: u.user_id,
          nome: profile?.full_name || profile?.email || 'Usuário',
          email: profile?.email || '',
          setor: undefined,
          funcao: u.role,
          atendimentosAtivos: 0,
          capacidadeMaxima: 10,
          status: "disponivel" as const,
        };
      });
      
      setColaboradores(mapped);
    } catch (e: any) {
      console.error('Erro ao carregar colaboradores:', e?.message || e);
      console.error('Detalhes do erro:', JSON.stringify(e, null, 2));
      toast({
        variant: "destructive",
        title: "Erro ao carregar colaboradores",
        description: e?.message || "Não foi possível carregar os colaboradores.",
      });
      setColaboradores([]);
    }
  };

  const handleSaveToken = (integration: string) => {
    toast({
      title: "Token salvo",
      description: `Token de ${integration} salvo com sucesso`,
    });
  };

  const elevateSuperAdmin = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ variant: 'destructive', title: 'Você precisa estar autenticado' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('elevate-super-admin', {
        body: { action: 'elevate_super_admin' }
      });

      if (error) throw error;

      toast({ title: 'Sucesso!', description: 'Você agora é Super Admin' });
      
      // Recarregar roles
      await checkAccessAndRoles();
    } catch (error) {
      console.error('Erro ao elevar privilégio:', error);
      toast({ variant: 'destructive', title: 'Erro ao elevar privilégio' });
    }
  };

  const makeMasterAccount = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ variant: 'destructive', title: 'Você precisa estar autenticado' });
        return;
      }

      const { data, error } = await supabase.functions.invoke('elevate-super-admin', {
        body: { action: 'make_master_account' }
      });

      if (error) throw error;

      toast({ title: 'Sucesso!', description: 'Sua empresa agora é uma Conta Mestre' });
      
      // Recarregar roles
      await checkAccessAndRoles();
    } catch (error) {
      console.error('Erro ao tornar conta mestre:', error);
      toast({ variant: 'destructive', title: 'Erro ao tornar conta mestre' });
    }
  };

  const adicionarColaborador = async () => {
    if (!novoColaborador.nome || !novoColaborador.email) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Preencha nome e e-mail do usuário",
      });
      return;
    }
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(novoColaborador.email)) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "E-mail inválido",
      });
      return;
    }

    try {
      if (!currentCompany?.id) throw new Error('Empresa não encontrada');
      
      const { data, error } = await supabase.functions.invoke('criar-usuario-subconta', {
        body: {
          companyId: currentCompany.id,
          email: novoColaborador.email,
          full_name: novoColaborador.nome,
          role: novoColaborador.funcao || 'user',
        },
      });
      
      if (error) throw error;
      
      setNovoColaborador({ nome: "", email: "", setor: "", funcao: "", capacidadeMaxima: 10 });
      toast({ 
        title: "Usuário criado", 
        description: "Usuário criado e vinculado à empresa com sucesso." 
      });
      await carregarColaboradores();
    } catch (e: any) {
      console.error('Erro ao criar usuário:', e);
      toast({ 
        variant: 'destructive', 
        title: 'Erro ao criar usuário', 
        description: e.message || 'Ocorreu um erro ao criar o usuário. Verifique se o e-mail já não está cadastrado.' 
      });
    }
  };

  const removerColaborador = async (id: string) => {
    try {
      const { error } = await supabase.from('user_roles').delete().eq('id', id);
      if (error) throw error;
      await carregarColaboradores();
      toast({ title: 'Colaborador removido' });
    } catch (e: any) {
      console.error('Erro ao remover colaborador:', e);
      toast({ variant: 'destructive', title: 'Erro ao remover colaborador', description: e.message });
    }
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

  const defaultTab = isMasterAccount ? "subcontas" : "team";

  // Seções unificadas da aba Equipe & Permissões
  const FilasSection = () => (
    <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Filas de Atendimento</CardTitle>
                  <CardDescription>Gerencie as filas disponíveis no atendimento</CardDescription>
                </div>
                <Button onClick={abrirNovaFila}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Fila
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filasLoading && (
                  <div className="text-sm text-muted-foreground">Carregando filas...</div>
                )}
                {!filasLoading && filas.length === 0 && (
                  <div className="text-sm text-muted-foreground">Nenhuma fila cadastrada.</div>
                )}
                {!filasLoading && filas.map((fila) => (
                  <div key={fila.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold">{fila.nome}</h4>
                        {fila.ativa ? (
                          <Badge>Ativa</Badge>
                        ) : (
                          <Badge variant="secondary">Inativa</Badge>
                        )}
                        <Badge variant="outline">Prioridade {fila.prioridade ?? 0}</Badge>
                      </div>
                      {fila.descricao && (
                        <p className="text-sm text-muted-foreground mt-1">{fila.descricao}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => abrirGerenciarColaboradores(fila)}
                        title="Gerenciar colaboradores"
                      >
                        <UserCog className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => abrirEditarFila(fila)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removerFila(fila.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <FilaDialog
            open={filaDialogOpen}
            onOpenChange={fecharFilaDialog}
            fila={editingFila}
            onSuccess={carregarFilas}
          />

          <FilaColaboradoresDialog
            open={colaboradoresDialogOpen}
            onOpenChange={fecharColaboradoresDialog}
            filaId={filaSelecionada?.id || null}
          />
    </>
  );

  const ColaboradoresSection = () => (
    <>
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
                      onChange={(e) => {
                        const value = e.target.value;
                        setNovoColaborador(prev => ({ ...prev, nome: value }));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="email@example.com"
                      value={novoColaborador.email}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNovoColaborador(prev => ({ ...prev, email: value }));
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="setor">Setor</Label>
                    <Select
                      value={novoColaborador.setor}
                      onValueChange={(value) => {
                        setNovoColaborador(prev => ({ ...prev, setor: value }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione (opcional)" />
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
                    <Label htmlFor="funcao">Perfil</Label>
                    <Select
                      value={novoColaborador.funcao}
                      onValueChange={(value) => {
                        setNovoColaborador(prev => ({ ...prev, funcao: value }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o perfil" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company_admin">Administrador</SelectItem>
                        <SelectItem value="gestor">Gestor</SelectItem>
                        <SelectItem value="vendedor">Vendedor</SelectItem>
                        <SelectItem value="suporte">Suporte</SelectItem>
                        <SelectItem value="user">Usuário</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="capacidade">Capacidade Máxima</Label>
                    <Input
                      id="capacidade"
                      type="number"
                      min="1"
                      max="50"
                      value={novoColaborador.capacidadeMaxima}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 10;
                        setNovoColaborador(prev => ({ ...prev, capacidadeMaxima: value }));
                      }}
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
    </>
  );

  const PermissoesSection = () => (
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
  );

  const EquipeConfigSection = () => (
    <Card>
      <CardHeader>
        <CardTitle>Configurações de Equipe</CardTitle>
        <CardDescription>Preferências e regras de distribuição</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Atribuição automática de leads por fila</Label>
            <Select value="auto">
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Ativar</SelectItem>
                <SelectItem value="manual">Desativar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Relatórios de produtividade</Label>
            <Select value="habilitado">
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="habilitado">Habilitar</SelectItem>
                <SelectItem value="desabilitado">Desabilitar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const UsuariosEquipeSection = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Usuários do CRM</CardTitle>
            <CardDescription>Gerencie usuários e perfis desta empresa</CardDescription>
          </div>
          <Button onClick={() => setManageUsersOpen(true)}>Gerenciar Usuários</Button>
        </div>
      </CardHeader>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie integrações, tokens e configurações do sistema
        </p>
      </div>

      {latestAnnouncement && (
        <Alert className={latestAnnouncement.critical ? "border-destructive bg-destructive/10" : ""}>
          <AlertDescription className="space-y-1">
            <p className="font-medium">{latestAnnouncement.title}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{latestAnnouncement.body}</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Status do usuário - Mostra privilégios atuais */}
      <Card className={hasRole('super_admin') && isMasterAccount ? "border-green-500/50 bg-green-500/5" : "border-blue-500/50 bg-blue-500/5"}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {hasRole('super_admin') && isMasterAccount ? "✅" : "ℹ️"} Status da Conta
          </CardTitle>
          <CardDescription>
            Informações sobre seus privilégios e tipo de conta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Nível de Acesso:</div>
              <div className="flex flex-wrap gap-2">
                {userRoles.map((role) => (
                  <Badge key={role} variant={role === 'super_admin' ? 'default' : 'secondary'}>
                    {role === 'super_admin' ? '🔐 Super Admin' : role}
                  </Badge>
                ))}
                {userRoles.length === 0 && <Badge variant="secondary">Usuário Padrão</Badge>}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Tipo de Conta:</div>
              <Badge variant={isMasterAccount ? 'default' : 'secondary'}>
                {isMasterAccount ? '🏢 Conta Mestre (SaaS)' : '📋 Conta Cliente'}
              </Badge>
            </div>
          </div>
          
          {currentCompany && (
            <div className="pt-2 border-t">
              <div className="text-sm font-medium mb-1">Empresa Atual:</div>
              <div className="text-sm text-muted-foreground">{currentCompany.name}</div>
              <div className="text-xs text-muted-foreground">
                Plano: {currentCompany.plan} • 
                Usuários: {currentCompany.max_users} • 
                Leads: {currentCompany.max_leads}
              </div>
            </div>
          )}

          {hasRole('super_admin') && isMasterAccount && (
            <Alert className="border-green-500/50 bg-green-500/5">
              <AlertDescription>
                ✅ Você possui acesso completo como Super Admin de uma Conta Mestre. 
                Você pode criar e gerenciar subcontas/licenças SaaS na aba "Subcontas".
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 🔒 SEGURANÇA: Apenas super admin da conta MESTRE pode elevar privilégios */}
      {!isSubAccount && (!hasRole('super_admin') || !isMasterAccount) && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="text-lg">🔐 Elevação de Privilégios</CardTitle>
            <CardDescription>
              Eleve suas permissões para acessar funcionalidades avançadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {!hasRole('super_admin') && (
                <Button
                  variant="outline"
                  onClick={elevateSuperAdmin}
                  className="border-primary/50 hover:bg-primary/10"
                >
                  <UserCog className="mr-2 h-4 w-4" />
                  Tornar-me Super Admin
                </Button>
              )}
              {!isMasterAccount && (
                <Button
                  variant="outline"
                  onClick={makeMasterAccount}
                  className="border-purple-500/50 hover:bg-purple-500/10"
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  Tornar esta conta mestre
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              ⚠️ Use apenas se você é o administrador principal do sistema
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className={`grid w-full ${isMasterAccount ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {isMasterAccount && (
            <TabsTrigger value="subcontas">
              <Building2 className="mr-2 h-4 w-4" />
              Subcontas
            </TabsTrigger>
          )}
          <TabsTrigger value="team">Equipe & Permissões</TabsTrigger>
          <TabsTrigger value="channels">Canais & Integrações</TabsTrigger>
          <TabsTrigger value="ia">IA & Automação</TabsTrigger>
          <TabsTrigger value="webhooks_api">Webhooks & APIs</TabsTrigger>
        </TabsList>

        {isMasterAccount && (
          <TabsContent value="subcontas">
            <SubcontasManager />
          </TabsContent>
        )}

        <TabsContent value="team" className="space-y-4">
          {/* Usuários do CRM (todas as empresas podem gerenciar seus usuários) */}
          {currentCompany && <UsuariosEquipeSection />}
          {/* Filas de Atendimento e Colaboradores - disponíveis para todos */}
          <FilasSection />
          <ColaboradoresSection />
          {/* Permissões e Configurações de Equipe - reservado a administradores */}
          {(hasRole('admin') || hasRole('company_admin')) && <PermissoesSection />}
          {(hasRole('admin') || hasRole('company_admin')) && <EquipeConfigSection />}
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
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

        <TabsContent value="ia" className="space-y-4">
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

        <TabsContent value="webhooks_api" className="space-y-4">
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

      {currentCompany && (
        <UsuariosSubcontaDialog
          company={{ id: currentCompany.id, name: currentCompany.name }}
          open={manageUsersOpen}
          onOpenChange={setManageUsersOpen}
        />
      )}
    </div>
  );
}


