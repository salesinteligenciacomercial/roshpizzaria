import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Send, 
  Users, 
  MessageSquare, 
  Filter, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Search,
  X,
  Image,
  Video,
  FileText,
  Upload,
  Clock,
  Pause,
  LayoutTemplate
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { robustFormatPhoneNumber } from "@/utils/phoneFormatter";
import { TemplateSelector, Template } from "./TemplateSelector";

interface Lead {
  id: string;
  name: string;
  telefone: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  tags: string[] | null;
  segmentacao: string | null;
}

export function DisparoEmMassa() {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [selectedSegmentacao, setSelectedSegmentacao] = useState<string>("all");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableSegmentacoes, setAvailableSegmentacoes] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ sent: number; total: number; errors: number; paused?: boolean } | null>(null);
  
  // Configurações de mídia e timing
  const [messageType, setMessageType] = useState<"text" | "image" | "video" | "template">("text");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [delayBetweenMessages, setDelayBetweenMessages] = useState<number>(7); // segundos
  const [pauseAfterMessages, setPauseAfterMessages] = useState<number>(15); // quantidade
  const [pauseDuration, setPauseDuration] = useState<number>(120); // segundos (2 minutos)
  const [campanhaNome, setCampanhaNome] = useState<string>("");
  
  // Estados para templates
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [templateMediaUrl, setTemplateMediaUrl] = useState<string>("");

  // Carregar company_id e leads
  useEffect(() => {
    loadCompanyIdAndLeads();
  }, []);

  // Filtrar leads quando filtros mudarem
  useEffect(() => {
    filterLeads();
  }, [leads, searchTerm, selectedStatus, selectedTag, selectedSegmentacao]);

  const loadCompanyIdAndLeads = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!userRole?.company_id) {
        toast.error("Sua conta não está vinculada a uma empresa");
        return;
      }

      setCompanyId(userRole.company_id);
      await loadLeads(userRole.company_id);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    }
  };

  const loadLeads = async (companyId: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from("leads")
        .select("id, name, telefone, phone, email, status, tags, segmentacao")
        .eq("company_id", companyId)
        .not("telefone", "is", null)
        .or("telefone.not.is.null,phone.not.is.null");

      const { data, error } = await query;

      if (error) throw error;

      const leadsWithPhone = (data || []).filter(
        (lead) => lead.telefone || lead.phone
      ) as Lead[];

      setLeads(leadsWithPhone);

      // Extrair tags e segmentações únicas
      const tagsSet = new Set<string>();
      const segmentacoesSet = new Set<string>();

      leadsWithPhone.forEach((lead) => {
        if (lead.tags && Array.isArray(lead.tags)) {
          lead.tags.forEach((tag) => tagsSet.add(tag));
        }
        if (lead.segmentacao) {
          segmentacoesSet.add(lead.segmentacao);
        }
      });

      setAvailableTags(Array.from(tagsSet).sort());
      setAvailableSegmentacoes(Array.from(segmentacoesSet).sort());
    } catch (error: any) {
      console.error("Erro ao carregar leads:", error);
      toast.error("Erro ao carregar leads");
    } finally {
      setLoading(false);
    }
  };

  const filterLeads = () => {
    let filtered = [...leads];

    // Filtro de busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (lead) =>
          lead.name?.toLowerCase().includes(term) ||
          lead.email?.toLowerCase().includes(term) ||
          lead.telefone?.includes(term) ||
          lead.phone?.includes(term)
      );
    }

    // Filtro de status
    if (selectedStatus !== "all") {
      filtered = filtered.filter((lead) => lead.status === selectedStatus);
    }

    // Filtro de tag
    if (selectedTag !== "all") {
      filtered = filtered.filter(
        (lead) => lead.tags && lead.tags.includes(selectedTag)
      );
    }

    // Filtro de segmentação
    if (selectedSegmentacao !== "all") {
      filtered = filtered.filter(
        (lead) => lead.segmentacao === selectedSegmentacao
      );
    }

    setFilteredLeads(filtered);
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  const getSelectedLeadsData = () => {
    return filteredLeads.filter((lead) => selectedLeads.has(lead.id));
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const fileType = file.type;
    if (fileType.startsWith("image/")) {
      setMessageType("image");
      setMediaFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setMediaPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else if (fileType.startsWith("video/")) {
      setMessageType("video");
      setMediaFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setMediaPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      toast.error("Tipo de arquivo não suportado. Use imagem ou vídeo.");
      return;
    }
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMessageType("text");
  };

  const convertFileToBase64 = (file: File): Promise<{ base64: string; mimeType: string; fileName: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        // Remover o prefixo "data:image/...;base64," ou "data:video/...;base64,"
        const base64 = base64String.split(',')[1] || base64String;
        resolve({
          base64,
          mimeType: file.type,
          fileName: file.name
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Função para construir componentes do template com variáveis do lead
  const buildTemplateComponents = (template: Template, lead: Lead): any[] => {
    const components: any[] = [];
    
    if (!template.components) return components;
    
    // Processar HEADER (mídia ou texto)
    const headerComponent = template.components.find((c: any) => c.type === "HEADER");
    if (headerComponent) {
      // Header com mídia (VIDEO, IMAGE, DOCUMENT)
      if (headerComponent.format && headerComponent.format !== "TEXT") {
        const mediaFormat = headerComponent.format.toLowerCase(); // video, image, document
        
        // Verificar se temos URL de mídia para o template
        if (templateMediaUrl) {
          const headerParams: any = {
            type: "header",
            parameters: [{
              type: mediaFormat,
              [mediaFormat]: {
                link: templateMediaUrl
              }
            }]
          };
          components.push(headerParams);
        } else if (headerComponent.example?.header_handle?.[0]) {
          // Usar handle do exemplo se disponível (mídia pré-registrada na Meta)
          const headerParams: any = {
            type: "header",
            parameters: [{
              type: mediaFormat,
              [mediaFormat]: {
                id: headerComponent.example.header_handle[0]
              }
            }]
          };
          components.push(headerParams);
        }
        // Se não tem mídia, Meta pode rejeitar - log de aviso
        else {
          console.warn("⚠️ Template com header de mídia mas sem URL fornecida:", headerComponent.format);
        }
      }
      // Header com texto e variáveis
      else if (headerComponent.text?.includes("{{")) {
        const matches = headerComponent.text.match(/\{\{(\d+)\}\}/g) || [];
        const parameters = matches.map((match: string) => {
          const varNum = match.replace(/[{}]/g, '');
          let value = templateVariables[varNum] || "";
          value = value.replace("{{nome}}", lead.name || "Cliente");
          return { type: "text", text: value || "Cliente" };
        });
        
        if (parameters.length > 0) {
          components.push({
            type: "header",
            parameters,
          });
        }
      }
    }
    
    // Processar variáveis para o BODY
    const bodyComponent = template.components.find((c: any) => c.type === "BODY");
    if (bodyComponent?.text?.includes("{{")) {
      const matches = bodyComponent.text.match(/\{\{(\d+)\}\}/g) || [];
      const parameters = matches.map((match: string) => {
        const varNum = match.replace(/[{}]/g, '');
        let value = templateVariables[varNum] || "";
        
        // Substituir placeholders dinâmicos
        value = value.replace("{{nome}}", lead.name || "Cliente");
        value = value.replace("{{telefone}}", lead.telefone || lead.phone || "");
        value = value.replace("{{email}}", lead.email || "");
        
        return { type: "text", text: value || "Cliente" };
      });
      
      if (parameters.length > 0) {
        components.push({
          type: "body",
          parameters,
        });
      }
    }
    
    return components;
  };

  // Função para construir o texto legível do template para salvar no banco
  const buildTemplateTextContent = (template: Template, lead: Lead): string => {
    if (!template.components) return `[Template: ${template.name}]`;
    
    let textContent = "";
    
    // Header
    const headerComponent = template.components.find((c: any) => c.type === "HEADER");
    if (headerComponent?.text) {
      let headerText = headerComponent.text;
      // Substituir variáveis
      const matches = headerText.match(/\{\{(\d+)\}\}/g) || [];
      matches.forEach((match: string) => {
        const varNum = match.replace(/[{}]/g, '');
        let value = templateVariables[varNum] || "";
        value = value.replace("{{nome}}", lead.name || "Cliente");
        headerText = headerText.replace(match, value || "Cliente");
      });
      textContent += `*${headerText}*\n\n`;
    }
    
    // Body
    const bodyComponent = template.components.find((c: any) => c.type === "BODY");
    if (bodyComponent?.text) {
      let bodyText = bodyComponent.text;
      // Substituir variáveis
      const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
      matches.forEach((match: string) => {
        const varNum = match.replace(/[{}]/g, '');
        let value = templateVariables[varNum] || "";
        value = value.replace("{{nome}}", lead.name || "Cliente");
        value = value.replace("{{telefone}}", lead.telefone || lead.phone || "");
        value = value.replace("{{email}}", lead.email || "");
        bodyText = bodyText.replace(match, value || "Cliente");
      });
      textContent += bodyText;
    }
    
    // Footer
    const footerComponent = template.components.find((c: any) => c.type === "FOOTER");
    if (footerComponent?.text) {
      textContent += `\n\n_${footerComponent.text}_`;
    }
    
    // Buttons
    const buttonsComponent = template.components.find((c: any) => c.type === "BUTTONS");
    if (buttonsComponent?.buttons && buttonsComponent.buttons.length > 0) {
      textContent += "\n\n";
      buttonsComponent.buttons.forEach((btn: any) => {
        textContent += `↪ ${btn.text}\n`;
      });
    }
    
    return textContent.trim() || `[Template: ${template.name}]`;
  };

  const handleDisparo = async () => {
    // Validações
    if (!campanhaNome.trim()) {
      toast.error("Digite um nome para a campanha");
      return;
    }

    if (messageType === "text" && !message.trim()) {
      toast.error("Digite uma mensagem para enviar");
      return;
    }

    if (messageType === "template" && !selectedTemplate) {
      toast.error("Selecione um template para enviar");
      return;
    }

    if ((messageType === "image" || messageType === "video") && !mediaFile) {
      toast.error("Selecione um arquivo de mídia");
      return;
    }

    // Validar URL de mídia para templates com header de vídeo/imagem
    if (messageType === "template" && selectedTemplate) {
      const headerComponent = selectedTemplate.components?.find((c: any) => c.type === "HEADER");
      if (headerComponent?.format && headerComponent.format !== "TEXT") {
        const hasHandle = headerComponent.example?.header_handle?.[0];
        if (!hasHandle && !templateMediaUrl) {
          toast.error(`Este template requer uma URL de ${headerComponent.format === "VIDEO" ? "vídeo" : headerComponent.format === "IMAGE" ? "imagem" : "documento"} no cabeçalho`);
          return;
        }
      }
    }

    const leadsToSend = getSelectedLeadsData();
    if (leadsToSend.length === 0) {
      toast.error("Selecione pelo menos um lead");
      return;
    }

    if (!companyId) {
      toast.error("Company ID não encontrado");
      return;
    }

    setSending(true);
    setProgress({ sent: 0, total: leadsToSend.length, errors: 0, paused: false });

    let successCount = 0;
    let errorCount = 0;
    let mediaData: { base64: string; mimeType: string; fileName: string } | null = null;
    const campanhaId = `campanha_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Converter mídia para base64 se necessário
    if (mediaFile) {
      try {
        mediaData = await convertFileToBase64(mediaFile);
      } catch (error) {
        toast.error("Erro ao processar arquivo de mídia");
        setSending(false);
        setProgress(null);
        return;
      }
    }

    for (let i = 0; i < leadsToSend.length; i++) {
      const lead = leadsToSend[i];
      const phone = lead.telefone || lead.phone;

      if (!phone) {
        errorCount++;
        setProgress({ sent: i + 1, total: leadsToSend.length, errors: errorCount, paused: false });
        continue;
      }

      try {
        // Formatar telefone
        const phoneValidation = robustFormatPhoneNumber(phone);
        if (!phoneValidation.isValid) {
          console.error(`Telefone inválido para lead ${lead.id}: ${phone}`);
          errorCount++;
          setProgress({ sent: i + 1, total: leadsToSend.length, errors: errorCount, paused: false });
          continue;
        }

        const formattedPhone = phoneValidation.formatted;
        
        // ⚡ CORREÇÃO CRÍTICA: Normalizar telefone para garantir consistência no agrupamento
        // O telefone_formatado deve ser apenas números (sem espaços, sem +) e sempre com prefixo 55
        let telefoneNormalizado = formattedPhone.replace(/[^0-9]/g, '');
        // Garantir que tenha prefixo 55 se não tiver (para consistência com realtime)
        if (!telefoneNormalizado.startsWith('55') && telefoneNormalizado.length >= 10) {
          telefoneNormalizado = `55${telefoneNormalizado}`;
        }

        // Preparar payload de envio
        const payload: any = {
          numero: formattedPhone,
          company_id: companyId,
        };

        if (messageType === "text") {
          payload.mensagem = message;
          payload.tipo_mensagem = "text";
        } else if (messageType === "template" && selectedTemplate) {
          // Envio de template via Meta API
          payload.template_name = selectedTemplate.name;
          payload.template_language = selectedTemplate.language;
          payload.template_components = buildTemplateComponents(selectedTemplate, lead);
          payload.tipo_mensagem = "template";
          payload.mensagem = `[Template: ${selectedTemplate.name}]`;
        } else if (messageType === "image" && mediaData) {
          payload.caption = message || "";
          payload.mensagem = message || "";
          payload.tipo_mensagem = "image";
          payload.mediaBase64 = mediaData.base64;
          payload.mimeType = mediaData.mimeType;
          payload.fileName = mediaData.fileName;
        } else if (messageType === "video" && mediaData) {
          payload.caption = message || "";
          payload.mensagem = message || "";
          payload.tipo_mensagem = "video";
          payload.mediaBase64 = mediaData.base64;
          payload.mimeType = mediaData.mimeType;
          payload.fileName = mediaData.fileName;
        }

        // Enviar via função Edge
        const { data, error } = await supabase.functions.invoke("enviar-whatsapp", {
          body: payload,
        });

        if (error) {
          console.error(`Erro ao enviar para ${lead.name}:`, error);
          errorCount++;
        } else {
          successCount++;

          // Salvar no banco de dados - importante para aparecer no CRM
          // Usar telefone normalizado (apenas números) para garantir agrupamento correto
          // Gerar conteúdo da mensagem baseado no tipo
          let mensagemConteudo = message;
          if (messageType === "template" && selectedTemplate) {
            // Construir texto do template para salvar
            const templateText = buildTemplateTextContent(selectedTemplate, lead);
            mensagemConteudo = templateText || `[Template: ${selectedTemplate.name}]`;
          } else if (messageType === "image" && !message) {
            mensagemConteudo = "[Imagem]";
          } else if (messageType === "video" && !message) {
            mensagemConteudo = "[Vídeo]";
          }
          
          const conversaData: any = {
            numero: telefoneNormalizado, // Número normalizado (apenas dígitos)
            telefone_formatado: telefoneNormalizado, // Mesmo formato para agrupamento consistente
            mensagem: mensagemConteudo,
            origem: "WhatsApp",
            status: "Enviada",
            tipo_mensagem: messageType,
            nome_contato: lead.name || "Lead",
            company_id: companyId,
            lead_id: lead.id, // Vincular ao lead
            campanha_nome: campanhaNome.trim(), // Nome da campanha
            campanha_id: campanhaId, // ID único da campanha
            fromme: true, // Marcar como mensagem enviada pelo usuário
            delivered: true, // Marcar como entregue
            is_group: false, // Garantir que não é grupo
          };

          // Adicionar URL da mídia se houver
          if (mediaData && messageType !== "text") {
            conversaData.media_url = `data:${mediaData.mimeType};base64,${mediaData.base64}`;
            conversaData.midia_url = `data:${mediaData.mimeType};base64,${mediaData.base64}`; // Também salvar em midia_url (campo usado pelo sistema)
            conversaData.arquivo_url = `data:${mediaData.mimeType};base64,${mediaData.base64}`;
            conversaData.arquivo_nome = mediaData.fileName;
          }

          const { error: insertError, data: insertedData } = await supabase.from("conversas").insert([conversaData]).select();
          
          if (insertError) {
            console.error(`❌ Erro ao salvar conversa no banco para ${lead.name}:`, insertError);
            console.error("Dados que tentaram ser salvos:", conversaData);
          } else {
            console.log(`✅ Conversa salva no banco para ${lead.name} (${telefoneNormalizado})`);
            console.log("Dados salvos:", insertedData?.[0]);
          }
        }

        setProgress({ sent: i + 1, total: leadsToSend.length, errors: errorCount, paused: false });

        // Pausa automática após X mensagens
        if (pauseAfterMessages > 0 && (i + 1) % pauseAfterMessages === 0 && i < leadsToSend.length - 1) {
          setProgress({ sent: i + 1, total: leadsToSend.length, errors: errorCount, paused: true });
          toast.info(`Pausa automática: ${pauseDuration} segundos após ${i + 1} mensagens enviadas`);
          await new Promise((resolve) => setTimeout(resolve, pauseDuration * 1000));
          setProgress({ sent: i + 1, total: leadsToSend.length, errors: errorCount, paused: false });
        }

        // Delay configurável entre mensagens
        if (i < leadsToSend.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayBetweenMessages * 1000));
        }
      } catch (error: any) {
        console.error(`Erro ao processar lead ${lead.id}:`, error);
        errorCount++;
        setProgress({ sent: i + 1, total: leadsToSend.length, errors: errorCount, paused: false });
      }
    }

    setSending(false);
    setProgress(null);

    if (errorCount === 0) {
      toast.success(`${successCount} mensagens enviadas com sucesso!`);
    } else {
      toast.warning(`${successCount} enviadas, ${errorCount} com erro`);
    }

    // Limpar seleção e mensagem
    setSelectedLeads(new Set());
    setMessage("");
    setMediaFile(null);
    setMediaPreview(null);
    setMessageType("text");
    setCampanhaNome("");
  };

  const selectedCount = selectedLeads.size;
  const totalFiltered = filteredLeads.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Disparo em Massa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filtros */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <Label className="font-semibold">Filtros de Seleção</Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Busca */}
              <div className="space-y-2">
                <Label>Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome, email, telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
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

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tag</Label>
                <Select value={selectedTag} onValueChange={setSelectedTag}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {availableTags.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Segmentação */}
              <div className="space-y-2">
                <Label>Segmentação</Label>
                <Select
                  value={selectedSegmentacao}
                  onValueChange={setSelectedSegmentacao}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {availableSegmentacoes.map((seg) => (
                      <SelectItem key={seg} value={seg}>
                        {seg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Estatísticas */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {totalFiltered} lead{totalFiltered !== 1 ? "s" : ""} encontrado
                    {totalFiltered !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">
                    {selectedCount} selecionado{selectedCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={totalFiltered === 0}
              >
                {selectedLeads.size === totalFiltered ? "Desmarcar Todos" : "Selecionar Todos"}
              </Button>
            </div>
          </div>

          {/* Lista de Leads */}
          <div className="space-y-2">
            <Label className="font-semibold">Selecionar Leads</Label>
            <div className="border rounded-lg max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Carregando leads...</p>
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="p-8 text-center">
                  <AlertCircle className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum lead encontrado com os filtros selecionados
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedLeads.has(lead.id)}
                        onCheckedChange={() => toggleLeadSelection(lead.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{lead.name || "Sem nome"}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {lead.telefone || lead.phone || "Sem telefone"}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {lead.tags && lead.tags.length > 0 && (
                          <div className="flex gap-1">
                            {lead.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {lead.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Nome da Campanha */}
          <div className="space-y-2">
            <Label className="font-semibold">Nome da Campanha *</Label>
            <Input
              placeholder="Ex: Promoção Black Friday 2024"
              value={campanhaNome}
              onChange={(e) => setCampanhaNome(e.target.value)}
              disabled={sending}
              required
            />
            <p className="text-xs text-muted-foreground">
              Dê um nome descritivo para identificar esta campanha nos relatórios
            </p>
          </div>

          {/* Configurações de Timing */}
          <Card className="bg-muted/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Configurações de Timing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Delay entre mensagens (segundos)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    value={delayBetweenMessages}
                    onChange={(e) => setDelayBetweenMessages(Number(e.target.value) || 7)}
                    disabled={sending}
                  />
                  <p className="text-xs text-muted-foreground">
                    Recomendado: 5-10 segundos
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Pausar após (mensagens)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={pauseAfterMessages}
                    onChange={(e) => setPauseAfterMessages(Number(e.target.value) || 0)}
                    disabled={sending}
                  />
                  <p className="text-xs text-muted-foreground">
                    0 = sem pausa automática
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Duração da pausa (segundos)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="600"
                    value={pauseDuration}
                    onChange={(e) => setPauseDuration(Number(e.target.value) || 120)}
                    disabled={sending || pauseAfterMessages === 0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ex: 120 = 2 minutos
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Editor de Mensagem */}
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Mensagem da Campanha
              </Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant={messageType === "text" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setMessageType("text");
                    setMediaFile(null);
                    setMediaPreview(null);
                    setSelectedTemplate(null);
                  }}
                  disabled={sending}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Texto
                </Button>
                <Button
                  type="button"
                  variant={messageType === "image" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setMessageType("image");
                    setSelectedTemplate(null);
                    if (!mediaFile) {
                      document.getElementById("media-upload")?.click();
                    }
                  }}
                  disabled={sending}
                >
                  <Image className="h-4 w-4 mr-1" />
                  Imagem
                </Button>
                <Button
                  type="button"
                  variant={messageType === "video" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setMessageType("video");
                    setSelectedTemplate(null);
                    if (!mediaFile) {
                      document.getElementById("media-upload")?.click();
                    }
                  }}
                  disabled={sending}
                >
                  <Video className="h-4 w-4 mr-1" />
                  Vídeo
                </Button>
                <Button
                  type="button"
                  variant={messageType === "template" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setMessageType("template");
                    setMediaFile(null);
                    setMediaPreview(null);
                  }}
                  disabled={sending}
                  className="border-primary/50"
                >
                  <LayoutTemplate className="h-4 w-4 mr-1" />
                  Template
                  <Badge variant="secondary" className="ml-1 text-xs">Meta</Badge>
                </Button>
              </div>
            </div>

            {/* Seletor de Template */}
            {messageType === "template" && companyId && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-4">
                  <TemplateSelector
                    companyId={companyId}
                    selectedTemplate={selectedTemplate}
                    onSelectTemplate={(template) => {
                      setSelectedTemplate(template);
                      // Limpar URL de mídia quando trocar template
                      setTemplateMediaUrl("");
                    }}
                    templateVariables={templateVariables}
                    onVariablesChange={setTemplateVariables}
                    mediaUrl={templateMediaUrl}
                    onMediaUrlChange={setTemplateMediaUrl}
                    disabled={sending}
                  />
                  <Alert className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>Templates Meta API:</strong> Mensagens com templates são enviadas via API oficial do WhatsApp 
                      e funcionam mesmo para contatos fora da janela de 24 horas.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}

            {/* Upload de Mídia */}
            {(messageType === "image" || messageType === "video") && (
              <div className="space-y-2">
                <Label>Arquivo de {messageType === "image" ? "Imagem" : "Vídeo"}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="media-upload"
                    type="file"
                    accept={messageType === "image" ? "image/*" : "video/*"}
                    onChange={handleMediaChange}
                    className="hidden"
                    disabled={sending}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("media-upload")?.click()}
                    disabled={sending}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {mediaFile ? "Trocar Arquivo" : "Selecionar Arquivo"}
                  </Button>
                  {mediaFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={removeMedia}
                      disabled={sending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {mediaPreview && (
                  <div className="mt-2">
                    {messageType === "image" ? (
                      <img
                        src={mediaPreview}
                        alt="Preview"
                        className="max-w-full max-h-64 rounded-lg border"
                      />
                    ) : (
                      <video
                        src={mediaPreview}
                        controls
                        className="max-w-full max-h-64 rounded-lg border"
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Editor de Texto - Ocultar quando usando template */}
            {messageType !== "template" && (
              <>
                <Textarea
                  placeholder={
                    messageType === "text"
                      ? "Digite a mensagem que será enviada para todos os leads selecionados..."
                      : messageType === "image"
                      ? "Digite a legenda da imagem (opcional)..."
                      : "Digite a legenda do vídeo (opcional)..."
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="resize-none"
                  disabled={sending}
                />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{message.length} caracteres</span>
                  <span>
                    {selectedCount > 0
                      ? `${selectedCount} destinatário${selectedCount !== 1 ? "s" : ""}`
                      : "Selecione leads para enviar"}
                  </span>
                </div>
              </>
            )}

            {/* Info para template */}
            {messageType === "template" && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {selectedTemplate 
                    ? `Template selecionado: ${selectedTemplate.name}` 
                    : "Nenhum template selecionado"}
                </span>
                <span>
                  {selectedCount > 0
                    ? `${selectedCount} destinatário${selectedCount !== 1 ? "s" : ""}`
                    : "Selecione leads para enviar"}
                </span>
              </div>
            )}
          </div>

          {/* Preview */}
          {((message || mediaFile || selectedTemplate) && selectedCount > 0) && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Preview:</strong> {messageType === "template" ? "Este template" : messageType === "text" ? "Esta mensagem" : messageType === "image" ? "Esta imagem" : "Este vídeo"} será enviado para{" "}
                <strong>{selectedCount}</strong> lead{selectedCount !== 1 ? "s" : ""}.
                {messageType === "text" && message && (
                  <div className="mt-2 p-3 bg-muted rounded border-l-2 border-primary">
                    {message}
                  </div>
                )}
                {messageType === "template" && selectedTemplate && (
                  <div className="mt-2 p-3 bg-muted rounded border-l-2 border-primary">
                    <div className="flex items-center gap-2 mb-1">
                      <LayoutTemplate className="h-4 w-4" />
                      <strong>{selectedTemplate.name}</strong>
                      <Badge variant="outline" className="text-xs">{selectedTemplate.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Idioma: {selectedTemplate.language} | Variáveis serão substituídas com dados de cada lead
                    </p>
                  </div>
                )}
                {(messageType === "image" || messageType === "video") && mediaPreview && (
                  <div className="mt-2">
                    {messageType === "image" ? (
                      <img
                        src={mediaPreview}
                        alt="Preview"
                        className="max-w-full max-h-48 rounded-lg border"
                      />
                    ) : (
                      <video
                        src={mediaPreview}
                        controls
                        className="max-w-full max-h-48 rounded-lg border"
                      />
                    )}
                    {message && (
                      <div className="mt-2 p-2 bg-muted rounded text-sm">
                        {message}
                      </div>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Progresso */}
          {progress && (
            <Alert>
              {progress.paused ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <AlertDescription>
                <strong>
                  {progress.paused ? "Pausa automática..." : "Enviando mensagens..."}
                </strong>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>
                      {progress.sent} de {progress.total}
                    </span>
                    <span>
                      {progress.errors > 0 && (
                        <span className="text-destructive">
                          {progress.errors} erro{progress.errors !== 1 ? "s" : ""}
                        </span>
                      )}
                      {progress.paused && (
                        <span className="text-yellow-600 ml-2">
                          Pausado por {pauseDuration}s
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        progress.paused ? "bg-yellow-500" : "bg-primary"
                      }`}
                      style={{
                        width: `${(progress.sent / progress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Botão de Envio */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedLeads(new Set());
                setMessage("");
                setMediaFile(null);
                setMediaPreview(null);
                setMessageType("text");
                setCampanhaNome("");
                setSearchTerm("");
                setSelectedStatus("all");
                setSelectedTag("all");
                setSelectedSegmentacao("all");
                setSelectedTemplate(null);
                setTemplateVariables({});
              }}
              disabled={sending}
            >
              <X className="h-4 w-4 mr-2" />
              Limpar
            </Button>
            <Button
              onClick={handleDisparo}
              disabled={
                sending ||
                !campanhaNome.trim() ||
                (messageType === "text" && !message.trim()) ||
                (messageType === "template" && !selectedTemplate) ||
                ((messageType === "image" || messageType === "video") && !mediaFile) ||
                selectedCount === 0 ||
                !companyId
              }
              className="min-w-[150px]"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar para {selectedCount > 0 ? selectedCount : ""} Lead
                  {selectedCount !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
