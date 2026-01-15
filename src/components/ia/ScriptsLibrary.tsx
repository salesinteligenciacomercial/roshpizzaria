import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Copy, 
  ThumbsUp, 
  ThumbsDown,
  Search,
  Plus,
  MessageSquare,
  Phone,
  Mail,
  Instagram,
  Flame,
  Sun,
  Snowflake,
  Edit,
  Trash2,
  Check,
  X,
  Star
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Script {
  id: string;
  name: string;
  description: string | null;
  trigger_context: string;
  script_template: string;
  target_channel: string | null;
  target_temperature: string[] | null;
  times_used: number | null;
  success_rate: number | null;
  success_count: number | null;
  tags: string[] | null;
  is_active: boolean;
}

// Scripts padrão embutidos caso a tabela esteja vazia
const DEFAULT_SCRIPTS: Omit<Script, 'id'>[] = [
  {
    name: "Primeiro Contato - Frio",
    description: "Para leads sem histórico de conversa",
    trigger_context: "primeiro_contato",
    script_template: `Olá {{nome}}! Tudo bem?

Sou da {{empresa}} e vi que você demonstrou interesse em nossos serviços.

Gostaria de entender melhor suas necessidades para ver como podemos te ajudar. Você tem alguns minutos para conversarmos?

Aguardo seu retorno! 😊`,
    target_channel: "whatsapp",
    target_temperature: ["frio"],
    times_used: 0,
    success_rate: null,
    success_count: 0,
    tags: ["inicial", "prospecção"],
    is_active: true,
  },
  {
    name: "Follow-up 3 dias",
    description: "Para leads que não responderam em 3 dias",
    trigger_context: "follow_up",
    script_template: `Olá {{nome}}, tudo bem?

Estou passando para dar continuidade à nossa conversa. Conseguiu analisar as informações que enviei?

Se tiver alguma dúvida ou precisar de mais detalhes, fico à disposição para esclarecer!

Abraços! 🤝`,
    target_channel: "whatsapp",
    target_temperature: ["morno", "frio"],
    times_used: 0,
    success_rate: null,
    success_count: 0,
    tags: ["follow-up", "reengajamento"],
    is_active: true,
  },
  {
    name: "Contornar Objeção - Preço",
    description: "Quando o lead menciona que está caro",
    trigger_context: "objecao_preco",
    script_template: `Entendo sua preocupação, {{nome}}!

O investimento realmente é uma decisão importante. Mas deixa eu te mostrar o valor por trás:

✅ {{beneficio_1}}
✅ {{beneficio_2}}
✅ {{beneficio_3}}

Além disso, temos condições especiais de pagamento que podem se adequar melhor ao seu orçamento. Posso te apresentar?`,
    target_channel: "whatsapp",
    target_temperature: ["morno", "quente"],
    times_used: 0,
    success_rate: null,
    success_count: 0,
    tags: ["objeção", "preço", "negociação"],
    is_active: true,
  },
  {
    name: "Contornar Objeção - Prazo",
    description: "Quando o lead quer mais prazo para decidir",
    trigger_context: "objecao_prazo",
    script_template: `Claro, {{nome}}! Entendo que você precisa de tempo para avaliar.

Enquanto isso, que tal eu te enviar:
📄 Um material detalhado sobre {{produto_servico}}
💡 Alguns cases de sucesso de clientes similares
📊 Uma comparação de resultados antes/depois

Assim você terá todas as informações para tomar a melhor decisão. Faz sentido?`,
    target_channel: "whatsapp",
    target_temperature: ["morno"],
    times_used: 0,
    success_rate: null,
    success_count: 0,
    tags: ["objeção", "prazo", "nutrir"],
    is_active: true,
  },
  {
    name: "Fechamento - Lead Quente",
    description: "Para leads prontos para fechar",
    trigger_context: "fechamento",
    script_template: `{{nome}}, que ótimo que você decidiu avançar! 🎉

Para formalizar, preciso de alguns dados:
📝 Nome completo
📧 E-mail
📄 CPF/CNPJ

Assim que tiver essas informações, já preparo tudo para você começar a aproveitar {{produto_servico}}.

Posso seguir?`,
    target_channel: "whatsapp",
    target_temperature: ["quente", "fechando"],
    times_used: 0,
    success_rate: null,
    success_count: 0,
    tags: ["fechamento", "conversão"],
    is_active: true,
  },
  {
    name: "Reengajamento - Lead Inativo",
    description: "Para leads sem contato há mais de 15 dias",
    trigger_context: "reengajamento",
    script_template: `Olá {{nome}}! Quanto tempo! 👋

Passei aqui para saber como você está e se ainda posso te ajudar com {{interesse_anterior}}.

Temos algumas novidades que podem te interessar:
🆕 {{novidade_1}}
🆕 {{novidade_2}}

Gostaria de saber mais? Estou por aqui!`,
    target_channel: "whatsapp",
    target_temperature: ["frio"],
    times_used: 0,
    success_rate: null,
    success_count: 0,
    tags: ["reengajamento", "inativo"],
    is_active: true,
  },
];

export const ScriptsLibrary: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContext, setSelectedContext] = useState<string>("all");
  const [showNewScript, setShowNewScript] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Form state for new script
  const [newScript, setNewScript] = useState({
    name: "",
    description: "",
    trigger_context: "primeiro_contato",
    script_template: "",
    target_channel: "whatsapp",
    target_temperature: [] as string[],
  });

  const loadScripts = useCallback(async () => {
    try {
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
        .from("ia_scripts")
        .select("*")
        .eq("company_id", userRole.company_id)
        .eq("is_active", true)
        .order("times_used", { ascending: false });

      // Se não há scripts no banco, usar os padrão
      if (!data || data.length === 0) {
        setScripts(DEFAULT_SCRIPTS.map((s, i) => ({ ...s, id: `default-${i}` })) as Script[]);
      } else {
        setScripts(data as Script[]);
      }
    } catch (error) {
      console.error("[ScriptsLibrary] Erro:", error);
      setScripts(DEFAULT_SCRIPTS.map((s, i) => ({ ...s, id: `default-${i}` })) as Script[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  const copyScript = async (script: Script) => {
    try {
      await navigator.clipboard.writeText(script.script_template);
      toast.success("Script copiado!");

      // Incrementar times_used se for script do banco
      if (!script.id.startsWith("default-") && companyId) {
        await supabase
          .from("ia_scripts")
          .update({ 
            times_used: (script.times_used || 0) + 1,
            last_used_at: new Date().toISOString()
          })
          .eq("id", script.id);
      }
    } catch (error) {
      toast.error("Erro ao copiar script");
    }
  };

  const markScriptSuccess = async (scriptId: string, success: boolean) => {
    if (scriptId.startsWith("default-")) {
      toast.info("Scripts padrão não podem ser avaliados");
      return;
    }

    try {
      const script = scripts.find(s => s.id === scriptId);
      if (!script) return;

      const newSuccessCount = (script.success_count || 0) + (success ? 1 : 0);
      const newTimesUsed = (script.times_used || 0) + 1;
      const newSuccessRate = Math.round((newSuccessCount / newTimesUsed) * 100);

      await supabase
        .from("ia_scripts")
        .update({
          success_count: newSuccessCount,
          success_rate: newSuccessRate,
          conversion_count: success ? (script.success_count || 0) + 1 : script.success_count,
        })
        .eq("id", scriptId);

      toast.success(success ? "Ótimo! Script marcado como efetivo" : "Feedback registrado");
      loadScripts();
    } catch (error) {
      toast.error("Erro ao salvar feedback");
    }
  };

  const saveNewScript = async () => {
    if (!companyId || !newScript.name || !newScript.script_template) {
      toast.error("Preencha nome e conteúdo do script");
      return;
    }

    try {
      const { error } = await supabase
        .from("ia_scripts")
        .insert({
          company_id: companyId,
          ...newScript,
          is_active: true,
          times_used: 0,
          success_count: 0,
        });

      if (error) throw error;

      toast.success("Script salvo!");
      setShowNewScript(false);
      setNewScript({
        name: "",
        description: "",
        trigger_context: "primeiro_contato",
        script_template: "",
        target_channel: "whatsapp",
        target_temperature: [],
      });
      loadScripts();
    } catch (error) {
      toast.error("Erro ao salvar script");
    }
  };

  const getChannelIcon = (channel: string | null) => {
    switch (channel) {
      case "whatsapp": return <MessageSquare className="h-4 w-4 text-green-500" />;
      case "call": return <Phone className="h-4 w-4 text-blue-500" />;
      case "email": return <Mail className="h-4 w-4 text-purple-500" />;
      case "instagram": return <Instagram className="h-4 w-4 text-pink-500" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTemperatureIcon = (temp: string) => {
    switch (temp) {
      case "quente":
      case "fechando": return <Flame className="h-3 w-3 text-orange-500" />;
      case "morno": return <Sun className="h-3 w-3 text-yellow-500" />;
      default: return <Snowflake className="h-3 w-3 text-blue-500" />;
    }
  };

  const filteredScripts = scripts.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         s.script_template.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesContext = selectedContext === "all" || s.trigger_context === selectedContext;
    return matchesSearch && matchesContext;
  });

  const contexts = [
    { value: "all", label: "Todos" },
    { value: "primeiro_contato", label: "Primeiro Contato" },
    { value: "follow_up", label: "Follow-up" },
    { value: "objecao_preco", label: "Objeção Preço" },
    { value: "objecao_prazo", label: "Objeção Prazo" },
    { value: "fechamento", label: "Fechamento" },
    { value: "reengajamento", label: "Reengajamento" },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Biblioteca de Scripts
            </CardTitle>
            <CardDescription>
              Scripts prontos para cada situação de vendas
            </CardDescription>
          </div>
          <Dialog open={showNewScript} onOpenChange={setShowNewScript}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Novo Script
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Criar Novo Script</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nome</label>
                    <Input
                      value={newScript.name}
                      onChange={e => setNewScript({ ...newScript, name: e.target.value })}
                      placeholder="Ex: Follow-up 7 dias"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Contexto</label>
                    <Select
                      value={newScript.trigger_context}
                      onValueChange={v => setNewScript({ ...newScript, trigger_context: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {contexts.filter(c => c.value !== "all").map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <Input
                    value={newScript.description}
                    onChange={e => setNewScript({ ...newScript, description: e.target.value })}
                    placeholder="Quando usar este script..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Script</label>
                  <Textarea
                    value={newScript.script_template}
                    onChange={e => setNewScript({ ...newScript, script_template: e.target.value })}
                    placeholder="Olá {{nome}}! ..."
                    rows={8}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {"{{nome}}"}, {"{{empresa}}"}, {"{{produto_servico}}"} para variáveis
                  </p>
                </div>
                <Button className="w-full" onClick={saveNewScript}>
                  <Check className="h-4 w-4 mr-2" />
                  Salvar Script
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search and Filter */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar scripts..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedContext} onValueChange={setSelectedContext}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {contexts.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Scripts List */}
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {filteredScripts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum script encontrado</p>
              </div>
            ) : (
              filteredScripts.map(script => (
                <div
                  key={script.id}
                  className="p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        {getChannelIcon(script.target_channel)}
                        <span className="font-medium">{script.name}</span>
                        {script.success_rate && script.success_rate > 70 && (
                          <Badge className="bg-green-100 text-green-800">
                            <Star className="h-3 w-3 mr-1" />
                            {script.success_rate}% efetivo
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {script.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {script.target_temperature?.map(temp => (
                        <span key={temp} className="flex items-center">
                          {getTemperatureIcon(temp)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Script Preview */}
                  <div className="bg-muted/50 rounded p-3 text-sm mb-3 whitespace-pre-line">
                    {script.script_template.length > 200 
                      ? script.script_template.substring(0, 200) + "..." 
                      : script.script_template
                    }
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {script.times_used && script.times_used > 0 && (
                        <span>Usado {script.times_used}x</span>
                      )}
                      {script.tags?.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyScript(script)}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copiar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markScriptSuccess(script.id, true)}
                      >
                        <ThumbsUp className="h-4 w-4 text-green-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markScriptSuccess(script.id, false)}
                      >
                        <ThumbsDown className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
