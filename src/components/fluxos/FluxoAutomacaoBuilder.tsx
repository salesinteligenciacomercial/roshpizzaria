import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  MessageSquare, 
  User, 
  Calendar, 
  Target,
  ArrowRight,
  Trash2,
  Play,
  Save
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

interface FluxoNode {
  id: string;
  type: "trigger" | "action" | "condition";
  label: string;
  config: any;
  next?: string[];
}

interface Fluxo {
  id: string;
  nome: string;
  ativo: boolean;
  nodes: FluxoNode[];
}

export function FluxoAutomacaoBuilder() {
  const [fluxos, setFluxos] = useState<Fluxo[]>([
    {
      id: "1",
      nome: "Boas-vindas Automático",
      ativo: true,
      nodes: [
        { id: "n1", type: "trigger", label: "Nova mensagem WhatsApp", config: { channel: "whatsapp" }, next: ["n2"] },
        { id: "n2", type: "action", label: "Enviar saudação", config: { message: "Olá! Como posso ajudar?" }, next: ["n3"] },
        { id: "n3", type: "action", label: "Criar lead", config: { funil: "Novo" }, next: [] },
      ]
    }
  ]);
  
  const [selectedFluxo, setSelectedFluxo] = useState<Fluxo | null>(null);
  const [editMode, setEditMode] = useState(false);

  const nodeTypes = [
    { value: "trigger", label: "Gatilho", icon: MessageSquare, color: "bg-blue-500" },
    { value: "action", label: "Ação", icon: Play, color: "bg-green-500" },
    { value: "condition", label: "Condição", icon: Target, color: "bg-orange-500" },
  ];

  const triggers = [
    { value: "nova_mensagem", label: "Nova mensagem recebida" },
    { value: "novo_lead", label: "Novo lead criado" },
    { value: "lead_movido", label: "Lead movido no funil" },
    { value: "horario", label: "Em horário específico" },
  ];

  const actions = [
    { value: "enviar_mensagem", label: "Enviar mensagem", icon: MessageSquare },
    { value: "criar_lead", label: "Criar lead", icon: User },
    { value: "criar_tarefa", label: "Criar tarefa", icon: Calendar },
    { value: "mover_funil", label: "Mover no funil", icon: Target },
    { value: "notificar_usuario", label: "Notificar usuário", icon: User },
  ];

  const adicionarNode = (fluxoId: string, tipo: string) => {
    const newNode: FluxoNode = {
      id: `n${Date.now()}`,
      type: tipo as any,
      label: `Novo ${tipo}`,
      config: {},
      next: []
    };

    setFluxos(prev => prev.map(f => {
      if (f.id === fluxoId) {
        return { ...f, nodes: [...f.nodes, newNode] };
      }
      return f;
    }));

    toast.success("Etapa adicionada ao fluxo");
  };

  const removerNode = (fluxoId: string, nodeId: string) => {
    setFluxos(prev => prev.map(f => {
      if (f.id === fluxoId) {
        return { ...f, nodes: f.nodes.filter(n => n.id !== nodeId) };
      }
      return f;
    }));
    toast.success("Etapa removida");
  };

  const toggleFluxo = (fluxoId: string) => {
    setFluxos(prev => prev.map(f => {
      if (f.id === fluxoId) {
        const newStatus = !f.ativo;
        toast.success(newStatus ? "Fluxo ativado" : "Fluxo desativado");
        return { ...f, ativo: newStatus };
      }
      return f;
    }));
  };

  const criarNovoFluxo = () => {
    const novoFluxo: Fluxo = {
      id: `f${Date.now()}`,
      nome: "Novo Fluxo",
      ativo: false,
      nodes: []
    };
    setFluxos(prev => [...prev, novoFluxo]);
    setSelectedFluxo(novoFluxo);
    setEditMode(true);
    toast.success("Novo fluxo criado");
  };

  const getNodeIcon = (type: string) => {
    const nodeType = nodeTypes.find(nt => nt.value === type);
    return nodeType ? nodeType.icon : Play;
  };

  const getNodeColor = (type: string) => {
    const nodeType = nodeTypes.find(nt => nt.value === type);
    return nodeType ? nodeType.color : "bg-gray-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Fluxos de Automação</h2>
          <p className="text-muted-foreground">
            Crie fluxos visuais para automatizar atendimento e processos
          </p>
        </div>
        <Button onClick={criarNovoFluxo}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Fluxo
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {fluxos.map((fluxo) => (
          <Card key={fluxo.id} className="border-0 shadow-card hover:shadow-lg transition-all">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{fluxo.nome}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={fluxo.ativo ? "default" : "secondary"}>
                    {fluxo.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                  <Button
                    size="sm"
                    variant={fluxo.ativo ? "outline" : "default"}
                    onClick={() => toggleFluxo(fluxo.id)}
                  >
                    {fluxo.ativo ? "Desativar" : "Ativar"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {fluxo.nodes.map((node, index) => (
                  <div key={node.id}>
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group hover:bg-muted transition-colors">
                      <div className={`p-2 rounded-lg ${getNodeColor(node.type)}`}>
                        {(() => {
                          const Icon = getNodeIcon(node.type);
                          return <Icon className="h-4 w-4 text-white" />;
                        })()}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{node.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {node.type === "trigger" ? "Gatilho" : 
                           node.type === "action" ? "Ação" : "Condição"}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removerNode(fluxo.id, node.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    {index < fluxo.nodes.length - 1 && (
                      <div className="flex justify-center py-1">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Etapa
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Etapa ao Fluxo</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Tipo de Etapa</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {nodeTypes.map((tipo) => (
                          <Button
                            key={tipo.value}
                            variant="outline"
                            className="h-auto flex-col gap-2 py-4"
                            onClick={() => {
                              adicionarNode(fluxo.id, tipo.value);
                            }}
                          >
                            <div className={`p-2 rounded-lg ${tipo.color}`}>
                              <tipo.icon className="h-5 w-5 text-white" />
                            </div>
                            <span className="text-xs">{tipo.label}</span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {selectedFluxo && (
                      <>
                        <div className="space-y-2">
                          <Label>Configurar Gatilho</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o gatilho" />
                            </SelectTrigger>
                            <SelectContent>
                              {triggers.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Configurar Ação</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a ação" />
                            </SelectTrigger>
                            <SelectContent>
                              {actions.map((a) => (
                                <SelectItem key={a.value} value={a.value}>
                                  {a.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Mensagem / Conteúdo</Label>
                          <Textarea 
                            placeholder="Digite a mensagem ou conteúdo da ação..."
                            rows={3}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {fluxos.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Play className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum fluxo criado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie seu primeiro fluxo de automação para começar
            </p>
            <Button onClick={criarNovoFluxo}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Fluxo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
