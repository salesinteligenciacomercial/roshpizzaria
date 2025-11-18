import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Send, 
  Users, 
  Tag, 
  Filter, 
  MessageSquare, 
  CheckCircle2, 
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  Play,
  Pause,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { formatPhoneNumber } from "@/utils/phoneFormatter";

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  telefone: string | null;
  email: string | null;
  status: string;
  tags: string[] | null;
  source: string | null;
  company: string | null;
}

interface Campanha {
  id: string;
  nome: string;
  mensagem: string;
  total_leads: number;
  enviados: number;
  sucesso: number;
  falhas: number;
  status: 'rascunho' | 'enviando' | 'pausada' | 'concluida' | 'cancelada';
  created_at: string;
}

export function DisparoEmMassa() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  
  // Filtros de segmentação
  const [filtroStatus, setFiltroStatus] = useState<string>("all");
  const [filtroTag, setFiltroTag] = useState<string>("all");
  const [filtroOrigem, setFiltroOrigem] = useState<string>("all");
  const [filtroBusca, setFiltroBusca] = useState<string>("");
  
  // Mensagem
  const [nomeCampanha, setNomeCampanha] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [taxaEnvio, setTaxaEnvio] = useState(10); // mensagens por minuto
  
  // Estatísticas do envio
  const [statsEnvio, setStatsEnvio] = useState({
    total: 0,
    enviados: 0,
    sucesso: 0,
    falhas: 0,
    progresso: 0
  });

  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    carregarCompanyId();
  }, []);

  useEffect(() => {
    if (companyId) {
      carregarLeads();
      carregarCampanhas();
    }
  }, [filtroStatus, filtroTag, filtroOrigem, filtroBusca, companyId]);

  const carregarCompanyId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (userRole?.company_id) {
        setCompanyId(userRole.company_id);
      }
    } catch (error) {
      console.error("Erro ao carregar company_id:", error);
    }
  };

  const carregarLeads = async () => {
    if (!companyId) return;

    setLoading(true);
    try {
      let query = supabase
        .from("leads")
        .select("id, name, phone, telefone, email, status, tags, source, company")
        .eq("company_id", companyId)
        .not("telefone", "is", null)
        .or("telefone.not.is.null,phone.not.is.null");

      // Aplicar filtros
      if (filtroStatus !== "all") {
        query = query.eq("status", filtroStatus);
      }

      if (filtroOrigem !== "all") {
        query = query.eq("source", filtroOrigem);
      }

      if (filtroBusca) {
        query = query.or(`name.ilike.%${filtroBusca}%,phone.ilike.%${filtroBusca}%,telefone.ilike.%${filtroBusca}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      let leadsFiltrados = data || [];

      // Filtrar por tag se necessário
      if (filtroTag !== "all") {
        leadsFiltrados = leadsFiltrados.filter(lead => 
          lead.tags && lead.tags.includes(filtroTag)
        );
      }

      setLeads(leadsFiltrados);
    } catch (error: any) {
      console.error("Erro ao carregar leads:", error);
      toast.error("Erro ao carregar leads");
    } finally {
      setLoading(false);
    }
  };

  const carregarCampanhas = async () => {
    if (!companyId) return;

    try {
      // Temporariamente desabilitado - tabela campanhas precisa ser criada
      console.warn("⚠️ Funcionalidade de campanhas desabilitada - tabela não existe");
      setCampanhas([]);
      /*
      const { data, error } = await supabase
        .from("campanhas")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        // Se a tabela não existir, tentar criar
        if (error.message?.includes("Could not find the table") || 
            error.message?.includes("relation") && error.message?.includes("does not exist")) {
          console.warn("⚠️ Tabela campanhas não existe. Execute a migration no Supabase.");
          toast.warning("Tabela de campanhas não encontrada. Execute a migration no banco de dados.");
          return;
        }
        throw error;
      }
      setCampanhas(data || []);
      */
    } catch (error: any) {
      console.error("Erro ao carregar campanhas:", error);
      // Não mostrar erro se for apenas tabela não encontrada
      if (!error.message?.includes("Could not find the table") && 
          !(error.message?.includes("relation") && error.message?.includes("does not exist"))) {
        toast.error("Erro ao carregar campanhas");
      }
    }
  };

  // Buscar todas as tags únicas
  const [todasTags, setTodasTags] = useState<string[]>([]);
  const [todasOrigens, setTodasOrigens] = useState<string[]>([]);

  useEffect(() => {
    if (companyId) {
      supabase
        .from("leads")
        .select("tags, source")
        .eq("company_id", companyId)
        .then(({ data }) => {
          if (data) {
            const tagsSet = new Set<string>();
            const origensSet = new Set<string>();
            
            data.forEach(lead => {
              if (lead.tags && Array.isArray(lead.tags)) {
                lead.tags.forEach(tag => tagsSet.add(tag));
              }
              if (lead.source) {
                origensSet.add(lead.source);
              }
            });
            
            setTodasTags(Array.from(tagsSet));
            setTodasOrigens(Array.from(origensSet));
          }
        });
    }
  }, [companyId]);

  const toggleSelectLead = (leadId: string) => {
    setSelectedLeads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map(l => l.id)));
    }
  };

  // Substituir variáveis na mensagem
  const processarMensagem = (mensagem: string, lead: Lead): string => {
    let msg = mensagem;
    msg = msg.replace(/\{nome\}/g, lead.name || "Cliente");
    msg = msg.replace(/\{telefone\}/g, lead.telefone || lead.phone || "");
    msg = msg.replace(/\{email\}/g, lead.email || "");
    msg = msg.replace(/\{empresa\}/g, lead.company || "");
    return msg;
  };

  const previewMensagem = () => {
    if (!mensagem || leads.length === 0) return mensagem;
    const primeiroLead = leads[0];
    return processarMensagem(mensagem, primeiroLead);
  };

  const enviarCampanha = async () => {
    if (!nomeCampanha.trim()) {
      toast.error("Digite um nome para a campanha");
      return;
    }

    if (!mensagem.trim()) {
      toast.error("Digite a mensagem da campanha");
      return;
    }

    if (selectedLeads.size === 0) {
      toast.error("Selecione pelo menos um lead");
      return;
    }

    if (!companyId) {
      toast.error("Erro: empresa não identificada");
      return;
    }

    setSending(true);

    try {
      // Temporariamente desabilitado - tabela campanhas precisa ser criada
      toast.warning("Funcionalidade de campanhas em massa desabilitada - entre em contato com suporte");
      setSending(false);
      return;
      
      /*
      // Criar campanha no banco
      const { data: campanha, error: campanhaError } = await supabase
        .from("campanhas")
        .insert({
          nome: nomeCampanha,
          mensagem: mensagem,
          company_id: companyId,
          total_leads: selectedLeads.size,
          status: 'enviando'
        })
        .select()
        .single();

      if (campanhaError) {
        // Se a tabela não existir, mostrar mensagem clara
        if (campanhaError.message?.includes("Could not find the table") ||
            (campanhaError.message?.includes("relation") && campanhaError.message?.includes("does not exist"))) {
          toast.error("Tabela de campanhas não encontrada. Execute a migration no Supabase SQL Editor.");
          console.error("❌ Execute este SQL no Supabase SQL Editor:");
          console.error(`
-- Copie e execute este SQL no Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS public.campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  total_leads INTEGER DEFAULT 0,
  enviados INTEGER DEFAULT 0,
  sucesso INTEGER DEFAULT 0,
  falhas INTEGER DEFAULT 0,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviando', 'pausada', 'concluida', 'cancelada')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
          `);
          throw new Error("Tabela campanhas não existe. Execute a migration primeiro.");
        }
        throw campanhaError;
      }

      // Inicializar estatísticas
      setStatsEnvio({
        total: selectedLeads.size,
        enviados: 0,
        sucesso: 0,
        falhas: 0,
        progresso: 0
      });

      // Obter leads selecionados
      const leadsParaEnviar = leads.filter(l => selectedLeads.has(l.id));
      
      let sucesso = 0;
      let falhas = 0;
      const delay = (60000 / taxaEnvio); // delay em ms entre mensagens

      // Enviar mensagens
      for (let i = 0; i < leadsParaEnviar.length; i++) {
        const lead = leadsParaEnviar[i];
        const telefone = formatPhoneNumber(lead.telefone || lead.phone || "");
        const mensagemProcessada = processarMensagem(mensagem, lead);

        try {
          // Chamar função do Supabase para enviar WhatsApp
          const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
            body: {
              numero: telefone,
              mensagem: mensagemProcessada,
              company_id: companyId
            }
          });

          if (error) throw error;

          sucesso++;
          
          // Registrar envio na tabela de conversas
          await supabase.from("conversas").insert({
            numero: telefone,
            telefone_formatado: telefone.replace(/\D/g, ""),
            mensagem: mensagemProcessada,
            nome_contato: lead.name,
            status: "Enviada",
            origem: "Campanha",
            company_id: companyId
          });

        } catch (error: any) {
          console.error(`Erro ao enviar para ${lead.name}:`, error);
          falhas++;
        }

        // Atualizar estatísticas
        setStatsEnvio({
          total: selectedLeads.size,
          enviados: i + 1,
          sucesso,
          falhas,
          progresso: ((i + 1) / selectedLeads.size) * 100
        });

        // Aguardar antes de enviar próxima mensagem (controle de taxa)
        if (i < leadsParaEnviar.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Atualizar campanha
      await supabase
        .from("campanhas")
        .update({
          enviados: selectedLeads.size,
          sucesso,
          falhas,
          status: 'concluida'
        })
        .eq("id", campanha.id);

      toast.success(`Campanha enviada! ${sucesso} sucesso, ${falhas} falhas`);
      
      // Limpar seleção
      setSelectedLeads(new Set());
      setNomeCampanha("");
      setMensagem("");
      
      // Recarregar campanhas
      carregarCampanhas();
      */

    } catch (error: any) {
      console.error("Erro ao enviar campanha:", error);
      // toast.error(`Erro ao enviar campanha: ${error.message}`);
    } finally {
      setSending(false);
      setStatsEnvio({
        total: 0,
        enviados: 0,
        sucesso: 0,
        falhas: 0,
        progresso: 0
      });
    }
  };

  const leadsFiltrados = leads.filter(lead => {
    const telefone = (lead.telefone || lead.phone || "").replace(/\D/g, "");
    return telefone.length >= 10;
  });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="criar" className="w-full">
        <TabsList>
          <TabsTrigger value="criar">Criar Campanha</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="criar" className="space-y-6">
          {/* Segmentação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Segmentação de Leads
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="novo">Novo</SelectItem>
                      <SelectItem value="em_contato">Em Contato</SelectItem>
                      <SelectItem value="qualificado">Qualificado</SelectItem>
                      <SelectItem value="negociacao">Negociação</SelectItem>
                      <SelectItem value="ganho">Ganho</SelectItem>
                      <SelectItem value="perdido">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tag</Label>
                  <Select value={filtroTag} onValueChange={setFiltroTag}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {todasTags.map(tag => (
                        <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {todasOrigens.map(origem => (
                        <SelectItem key={origem} value={origem}>{origem}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Buscar</Label>
                  <Input
                    placeholder="Nome ou telefone..."
                    value={filtroBusca}
                    onChange={(e) => setFiltroBusca(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-sm text-muted-foreground">
                  {leadsFiltrados.length} leads encontrados
                  {selectedLeads.size > 0 && ` • ${selectedLeads.size} selecionados`}
                </div>
                <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                  {selectedLeads.size === leadsFiltrados.length ? "Desselecionar Todos" : "Selecionar Todos"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Leads */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Selecionar Leads ({selectedLeads.size} selecionados)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : leadsFiltrados.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhum lead encontrado com os filtros aplicados.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {leadsFiltrados.map(lead => {
                    const telefone = lead.telefone || lead.phone || "";
                    const isSelected = selectedLeads.has(lead.id);
                    
                    return (
                      <div
                        key={lead.id}
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/10 border-primary" : "hover:bg-accent"
                        }`}
                        onClick={() => toggleSelectLead(lead.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelectLead(lead.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{lead.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {telefone} {lead.email && `• ${lead.email}`}
                          </div>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline">{lead.status}</Badge>
                            {lead.tags && lead.tags.map(tag => (
                              <Badge key={tag} variant="secondary">
                                <Tag className="h-3 w-3 mr-1" />
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mensagem */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Mensagem da Campanha
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Campanha</Label>
                <Input
                  placeholder="Ex: Promoção Black Friday 2024"
                  value={nomeCampanha}
                  onChange={(e) => setNomeCampanha(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea
                  placeholder="Digite sua mensagem aqui... Use {nome}, {telefone}, {email}, {empresa} para personalização"
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  rows={6}
                />
                <div className="text-xs text-muted-foreground">
                  Variáveis disponíveis: {"{nome}"}, {"{telefone}"}, {"{email}"}, {"{empresa}"}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Taxa de Envio (mensagens por minuto)</Label>
                <Input
                  type="number"
                  min="1"
                  max="60"
                  value={taxaEnvio}
                  onChange={(e) => setTaxaEnvio(parseInt(e.target.value) || 10)}
                />
                <div className="text-xs text-muted-foreground">
                  Recomendado: 10-20 mensagens/minuto para evitar bloqueios
                </div>
              </div>

              {mensagem && (
                <Card className="bg-muted">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Preview da Mensagem
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="whitespace-pre-wrap text-sm">
                      {previewMensagem()}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          {/* Estatísticas de Envio */}
          {sending && (
            <Card>
              <CardHeader>
                <CardTitle>Enviando Campanha...</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={statsEnvio.progresso} />
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold">{statsEnvio.total}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{statsEnvio.enviados}</div>
                    <div className="text-xs text-muted-foreground">Enviados</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{statsEnvio.sucesso}</div>
                    <div className="text-xs text-muted-foreground">Sucesso</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{statsEnvio.falhas}</div>
                    <div className="text-xs text-muted-foreground">Falhas</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Botão de Enviar */}
          <div className="flex justify-end gap-2">
            <Button
              onClick={enviarCampanha}
              disabled={sending || selectedLeads.size === 0 || !mensagem.trim()}
              size="lg"
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar Campanha ({selectedLeads.size} leads)
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Campanhas</CardTitle>
            </CardHeader>
            <CardContent>
              {campanhas.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhuma campanha criada ainda.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  {campanhas.map(campanha => (
                    <Card key={campanha.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">{campanha.nome}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {campanha.mensagem.substring(0, 100)}...
                            </p>
                            <div className="flex gap-4 mt-3 text-sm">
                              <div>
                                <span className="text-muted-foreground">Total: </span>
                                <span className="font-medium">{campanha.total_leads}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Enviados: </span>
                                <span className="font-medium text-blue-600">{campanha.enviados}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Sucesso: </span>
                                <span className="font-medium text-green-600">{campanha.sucesso}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Falhas: </span>
                                <span className="font-medium text-red-600">{campanha.falhas}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={
                              campanha.status === 'concluida' ? 'default' :
                              campanha.status === 'enviando' ? 'secondary' :
                              'outline'
                            }>
                              {campanha.status}
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-2">
                              {new Date(campanha.created_at).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
