import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MessageSquare, CheckSquare, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { AgendaModal } from "@/components/agenda/AgendaModal";
import { TarefaModal } from "@/components/tarefas/TarefaModal";

interface LeadActionsDialogProps {
  lead: {
    id: string;
    name: string;
    telefone?: string | null;
    phone?: string | null;
    email?: string | null;
  };
}

export function LeadActionsDialog({ lead }: LeadActionsDialogProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [agendaModalOpen, setAgendaModalOpen] = useState(false);
  const [tarefaModalOpen, setTarefaModalOpen] = useState(false);

  const abrirConversa = () => {
    const telefone = lead.telefone || lead.phone;
    if (telefone) {
      navigate("/conversas");
      setOpen(false);
      toast.success("Abrindo conversa...");
    } else {
      toast.error("Lead não possui telefone cadastrado");
    }
  };

  const abrirAgenda = () => {
    setOpen(false);
    setAgendaModalOpen(true);
  };

  const abrirTarefa = () => {
    setOpen(false);
    setTarefaModalOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ações para {lead.name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="conversa" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="conversa">
              <MessageSquare className="h-4 w-4 mr-2" />
              Conversa
            </TabsTrigger>
            <TabsTrigger value="agenda">
              <Calendar className="h-4 w-4 mr-2" />
              Compromisso
            </TabsTrigger>
            <TabsTrigger value="tarefa">
              <CheckSquare className="h-4 w-4 mr-2" />
              Tarefa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversa" className="space-y-4">
            <div className="text-center py-8 space-y-4">
              <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {lead.telefone || lead.phone
                  ? "Abrir conversa do WhatsApp com este lead"
                  : "Lead não possui telefone cadastrado"}
              </p>
              <Button
                onClick={abrirConversa}
                disabled={!lead.telefone && !lead.phone}
                className="w-full"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Abrir Conversa WhatsApp
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="agenda" className="space-y-4">
            <div className="text-center py-8 space-y-4">
              <Calendar className="h-16 w-16 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Criar um compromisso para {lead.name}
              </p>
              <Button onClick={abrirAgenda} className="w-full">
                <Calendar className="h-4 w-4 mr-2" />
                Criar Compromisso
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="tarefa" className="space-y-4">
            <div className="text-center py-8 space-y-4">
              <CheckSquare className="h-16 w-16 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Criar uma tarefa para {lead.name}
              </p>
              <Button onClick={abrirTarefa} className="w-full">
                <CheckSquare className="h-4 w-4 mr-2" />
                Criar Tarefa
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>

      <AgendaModal
        open={agendaModalOpen}
        onOpenChange={setAgendaModalOpen}
        lead={{
          id: lead.id,
          nome: lead.name,
          telefone: lead.telefone || lead.phone || ""
        }}
        onAgendamentoCriado={() => {
          setAgendaModalOpen(false);
          toast.success("Compromisso criado com sucesso!");
        }}
      />

      <TarefaModal
        open={tarefaModalOpen}
        onOpenChange={setTarefaModalOpen}
        lead={{
          id: lead.id,
          nome: lead.name
        }}
        onTarefaCriada={() => {
          setTarefaModalOpen(false);
          toast.success("Tarefa criada com sucesso!");
        }}
      />
    </Dialog>
  );
}
