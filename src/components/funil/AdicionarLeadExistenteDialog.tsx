import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AdicionarLeadExistenteDialogProps {
  funilId: string;
  etapaInicial: {
    id: string;
    nome: string;
  };
  onLeadAdded: () => void;
}

interface Lead {
  id: string;
  name: string;
  company?: string;
  telefone?: string;
  phone?: string;
  email?: string;
  funil_id?: string | null;
  funil_nome?: string;
}

export function AdicionarLeadExistenteDialog({ funilId, etapaInicial, onLeadAdded }: AdicionarLeadExistenteDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [selectedLeadInfo, setSelectedLeadInfo] = useState<Lead | null>(null);

  useEffect(() => {
    if (open) {
      carregarLeadsDisponiveis();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => carregarLeadsDisponiveis(), 300);
      return () => clearTimeout(id);
    }
  }, [search, open]);

  // Normaliza string para busca (remove acentos, converte para minúsculas)
  const normalizeString = (str: string): string => {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  };

  const carregarLeadsDisponiveis = async () => {
    try {
      console.log(`🔍 Buscando leads com termo: "${search}"`);
      
      // Busca todos os leads (com ou sem funil)
      const { data, error } = await supabase
        .from("leads")
        .select(`
          id, 
          name, 
          company, 
          telefone, 
          phone, 
          email,
          funil_id,
          funis:funil_id(nome)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      let filteredLeads = (data || []).map(lead => ({
        ...lead,
        funil_nome: (lead.funis as any)?.nome || null
      }));

      // Filtro local para melhor precisão
      if (search.trim()) {
        const searchNormalized = normalizeString(search);
        const phoneDigits = search.replace(/\D/g, "");

        filteredLeads = filteredLeads.filter(lead => {
          // Busca por nome (normalizado)
          const nameMatch = lead.name && normalizeString(lead.name).includes(searchNormalized);
          
          // Busca por telefone
          const telefone = lead.telefone || lead.phone || "";
          const telefoneDigits = telefone.replace(/\D/g, "");
          const phoneMatch = phoneDigits.length >= 4 && telefoneDigits.includes(phoneDigits);
          
          // Busca por email
          const emailMatch = lead.email && normalizeString(lead.email).includes(searchNormalized);
          
          // Busca por empresa
          const companyMatch = lead.company && normalizeString(lead.company).includes(searchNormalized);

          return nameMatch || phoneMatch || emailMatch || companyMatch;
        });
      }

      console.log(`✅ ${filteredLeads.length} leads encontrados`);
      setLeads(filteredLeads);
    } catch (error: any) {
      console.error("Erro ao carregar leads:", error);
      toast.error("Erro ao carregar leads disponíveis");
    }
  };

  const handleSelectLead = (leadId: string) => {
    setSelectedLead(leadId);
    const lead = leads.find(l => l.id === leadId);
    setSelectedLeadInfo(lead || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLead) {
      toast.error("Selecione um lead");
      return;
    }

    setLoading(true);

    try {
      // Buscar sessão do usuário atual
      const { data: { session } } = await supabase.auth.getSession();
      
      // 🔒 Buscar lead para preservar company_id e verificar owner_id
      const { data: leadData } = await supabase
        .from("leads")
        .select("company_id, owner_id")
        .eq("id", selectedLead)
        .single();

      // Se o lead não tem owner_id, atribuir o usuário atual
      const updateData: any = {
        funil_id: funilId,
        etapa_id: etapaInicial.id,
        status: "ativo",
        company_id: leadData?.company_id // 🔒 Preservar company_id
      };

      // Atribuir owner_id se não existir e houver usuário logado
      if (!leadData?.owner_id && session?.user?.id) {
        updateData.owner_id = session.user.id;
      }

      const { error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", selectedLead);

      if (error) throw error;

      toast.success("Lead adicionado ao funil com sucesso!");
      setOpen(false);
      setSelectedLead("");
      setSelectedLeadInfo(null);
      setSearch("");
      onLeadAdded();
    } catch (error: any) {
      console.error("Erro ao adicionar lead ao funil:", error);
      toast.error("Erro ao adicionar lead ao funil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) {
        setSelectedLead("");
        setSelectedLeadInfo(null);
        setSearch("");
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Lead Existente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Lead ao Funil</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Buscar (nome, telefone, email ou empresa)</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ex: Maria, Zé, 87999..."
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              A busca ignora acentos e maiúsculas/minúsculas
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="lead">Selecionar Lead *</Label>
            <Select
              value={selectedLead}
              onValueChange={handleSelectLead}
            >
              <SelectTrigger id="lead">
                <SelectValue placeholder="Escolha um lead" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {lead.name}
                        {lead.funil_id && (
                          <span className="ml-2 text-xs text-orange-500">
                            (em funil)
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {lead.company && `${lead.company} • `}
                        {lead.telefone || lead.phone || lead.email || "Sem contato"}
                      </span>
                    </div>
                  </SelectItem>
                ))}
                {leads.length === 0 && (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    {search ? "Nenhum lead encontrado com esse termo" : "Nenhum lead cadastrado"}
                  </div>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {leads.length} lead{leads.length !== 1 ? 's' : ''} encontrado{leads.length !== 1 ? 's' : ''}
            </p>
          </div>

          {selectedLeadInfo?.funil_id && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Este lead já está no funil "<strong>{selectedLeadInfo.funil_nome || 'Outro'}</strong>".
                Ao adicionar, ele será movido para este funil.
              </AlertDescription>
            </Alert>
          )}

          <div className="pt-4 border-t flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !selectedLead}
            >
              {loading ? "Adicionando..." : selectedLeadInfo?.funil_id ? "Mover para este Funil" : "Adicionar ao Funil"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
