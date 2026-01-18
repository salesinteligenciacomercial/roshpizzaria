import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sparkles,
  Copy,
  Save,
  Send,
  Check,
  ChevronsUpDown,
  Flame,
  Sun,
  Snowflake,
  MessageSquare,
  Mail,
  Phone,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  value: number | null;
  tags: string[] | null;
  updated_at: string | null;
}

interface GeneratedScript {
  script: string;
  suggested_channel: string;
  key_points: string[];
  objection_handled: string | null;
  tone: string;
  lead_name: string;
}

interface GenerateAIScriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveScript?: (script: { name: string; content: string; context: string }) => void;
}

const contexts = [
  { value: "primeiro_contato", label: "Primeiro Contato", description: "Para leads novos sem histórico" },
  { value: "follow_up", label: "Follow-up", description: "Retomar contato após dias sem resposta" },
  { value: "objecao_preco", label: "Objeção de Preço", description: "Quando o lead menciona que está caro" },
  { value: "objecao_prazo", label: "Objeção de Prazo", description: "Quando pedem mais tempo para decidir" },
  { value: "fechamento", label: "Fechamento", description: "Lead pronto para fechar negócio" },
  { value: "reengajamento", label: "Reengajamento", description: "Lead inativo há muito tempo" },
  { value: "apresentacao", label: "Apresentação", description: "Apresentar produto/serviço" },
  { value: "qualificacao", label: "Qualificação", description: "Entender necessidades do lead" },
];

export const GenerateAIScriptDialog: React.FC<GenerateAIScriptDialogProps> = ({
  open,
  onOpenChange,
  onSaveScript,
}) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedContext, setSelectedContext] = useState<string>("follow_up");
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [editedScript, setEditedScript] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [leadSelectorOpen, setLeadSelectorOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calcular dias desde último contato
  const getDaysSinceContact = (updatedAt: string | null) => {
    if (!updatedAt) return null;
    const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  // Carregar leads
  const loadLeads = useCallback(async () => {
    try {
      setLoadingLeads(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!userRole?.company_id) return;
      setCompanyId(userRole.company_id);

      const { data } = await supabase
        .from("leads")
        .select("id, name, phone, value, tags, updated_at")
        .eq("company_id", userRole.company_id)
        .neq("status", "perdido")
        .order("updated_at", { ascending: false })
        .limit(100);

      setLeads((data || []) as Lead[]);
    } catch (err) {
      console.error("[GenerateAIScriptDialog] Erro ao carregar leads:", err);
    } finally {
      setLoadingLeads(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadLeads();
      // Reset state when opening
      setGeneratedScript(null);
      setEditedScript("");
      setError(null);
    }
  }, [open, loadLeads]);

  // Gerar script
  const generateScript = async () => {
    if (!selectedLead || !companyId) {
      toast.error("Selecione um lead primeiro");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("gerar-script-personalizado", {
        body: {
          lead_id: selectedLead.id,
          context: selectedContext,
          company_id: companyId,
        },
      });

      if (fnError) throw fnError;

      if (data.error) {
        setError(data.error);
        toast.error(data.error);
        return;
      }

      setGeneratedScript(data as GeneratedScript);
      setEditedScript(data.script);
      toast.success("Script gerado com sucesso!");
    } catch (err) {
      console.error("[GenerateAIScriptDialog] Erro:", err);
      const message = err instanceof Error ? err.message : "Erro ao gerar script";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Copiar script
  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(editedScript);
      toast.success("Script copiado!");

      // Marcar como usado
      if (generatedScript && selectedLead) {
        await supabase
          .from("ia_scripts_generated")
          .update({ was_used: true })
          .eq("lead_id", selectedLead.id)
          .eq("script_content", generatedScript.script);
      }
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  // Salvar na biblioteca
  const saveToLibrary = async () => {
    if (!onSaveScript || !generatedScript) return;

    const contextLabel = contexts.find(c => c.value === selectedContext)?.label || selectedContext;
    onSaveScript({
      name: `Script IA - ${contextLabel} - ${generatedScript.lead_name}`,
      content: editedScript,
      context: selectedContext,
    });
    toast.success("Script salvo na biblioteca!");
  };

  // Abrir conversa com script preenchido
  const openConversation = () => {
    if (!selectedLead?.phone) {
      toast.error("Lead não possui telefone cadastrado");
      return;
    }
    
    // Salvar script no sessionStorage para o popup de conversa
    sessionStorage.setItem("prefilled_message", editedScript);
    
    // Navegar para conversas com o lead selecionado
    window.location.href = `/conversas?lead=${selectedLead.id}`;
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "whatsapp": return <MessageSquare className="h-4 w-4 text-green-500" />;
      case "email": return <Mail className="h-4 w-4 text-purple-500" />;
      case "call": return <Phone className="h-4 w-4 text-blue-500" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Gerar Script com IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Select Lead */}
          <div className="space-y-2">
            <label className="text-sm font-medium">1. Selecione o Lead</label>
            <Popover open={leadSelectorOpen} onOpenChange={setLeadSelectorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={leadSelectorOpen}
                  className="w-full justify-between"
                  disabled={loadingLeads}
                >
                  {loadingLeads ? (
                    "Carregando leads..."
                  ) : selectedLead ? (
                    <div className="flex items-center gap-2">
                      <span>{selectedLead.name}</span>
                      {selectedLead.value && (
                        <Badge variant="outline" className="ml-2">
                          R$ {selectedLead.value.toLocaleString('pt-BR')}
                        </Badge>
                      )}
                      {getDaysSinceContact(selectedLead.updated_at) !== null && (
                        <span className="text-xs text-muted-foreground">
                          ({getDaysSinceContact(selectedLead.updated_at)}d sem contato)
                        </span>
                      )}
                    </div>
                  ) : (
                    "Selecione um lead..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar lead por nome ou telefone..." />
                  <CommandList>
                    <CommandEmpty>Nenhum lead encontrado.</CommandEmpty>
                    <CommandGroup>
                      <ScrollArea className="h-[200px]">
                        {leads.map((lead) => (
                          <CommandItem
                            key={lead.id}
                            value={`${lead.name} ${lead.phone || ''}`}
                            onSelect={() => {
                              setSelectedLead(lead);
                              setLeadSelectorOpen(false);
                              setGeneratedScript(null);
                              setError(null);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedLead?.id === lead.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col flex-1">
                              <span className="font-medium">{lead.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {lead.phone || 'Sem telefone'}
                                {getDaysSinceContact(lead.updated_at) !== null && (
                                  <span> • {getDaysSinceContact(lead.updated_at)}d</span>
                                )}
                              </span>
                            </div>
                            {lead.value && (
                              <Badge variant="outline" className="text-xs">
                                R$ {lead.value.toLocaleString('pt-BR')}
                              </Badge>
                            )}
                          </CommandItem>
                        ))}
                      </ScrollArea>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Step 2: Select Context */}
          <div className="space-y-2">
            <label className="text-sm font-medium">2. Escolha o Contexto</label>
            <Select value={selectedContext} onValueChange={setSelectedContext}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contexts.map((ctx) => (
                  <SelectItem key={ctx.value} value={ctx.value}>
                    <div className="flex flex-col">
                      <span>{ctx.label}</span>
                      <span className="text-xs text-muted-foreground">{ctx.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Generate Button */}
          <Button
            className="w-full"
            onClick={generateScript}
            disabled={!selectedLead || loading}
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analisando histórico e gerando script...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar Script Personalizado
              </>
            )}
          </Button>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}

          {/* Generated Script */}
          {generatedScript && !loading && (
            <div className="space-y-4 border rounded-lg p-4">
              {/* Metadata */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="flex items-center gap-1">
                  {getChannelIcon(generatedScript.suggested_channel)}
                  Canal: {generatedScript.suggested_channel}
                </Badge>
                {generatedScript.tone && (
                  <Badge variant="secondary">
                    Tom: {generatedScript.tone}
                  </Badge>
                )}
                {generatedScript.objection_handled && (
                  <Badge className="bg-orange-100 text-orange-800">
                    Objeção tratada: {generatedScript.objection_handled}
                  </Badge>
                )}
              </div>

              {/* Key Points */}
              {generatedScript.key_points && generatedScript.key_points.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Pontos-chave:</p>
                  <div className="flex flex-wrap gap-1">
                    {generatedScript.key_points.map((point, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {point}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Editable Script */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Script (edite se necessário):</label>
                <Textarea
                  value={editedScript}
                  onChange={(e) => setEditedScript(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <Button onClick={copyScript} variant="outline">
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </Button>
                {onSaveScript && (
                  <Button onClick={saveToLibrary} variant="outline">
                    <Save className="h-4 w-4 mr-2" />
                    Salvar na Biblioteca
                  </Button>
                )}
                {selectedLead?.phone && (
                  <Button onClick={openConversation} className="bg-green-600 hover:bg-green-700">
                    <Send className="h-4 w-4 mr-2" />
                    Enviar pelo WhatsApp
                  </Button>
                )}
                <Button onClick={generateScript} variant="ghost" className="ml-auto">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
