import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, Search, Tag, MessageSquare, Phone, Mail, User, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LeadActionsDialog } from "@/components/leads/LeadActionsDialog";
import { LeadQuickActions } from "@/components/leads/LeadQuickActions";
import { LeadTagsDialog } from "@/components/leads/LeadTagsDialog";
import { NovoLeadDialog } from "@/components/funil/NovoLeadDialog";
import { ImportarLeadsDialog } from "@/components/funil/ImportarLeadsDialog";
import { formatPhoneNumber } from "@/utils/phoneFormatter";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  telefone?: string | null;
  company: string | null;
  source: string | null;
  status: string;
  stage: string;
  value: number;
  created_at: string;
  tags?: string[];
  cpf?: string | null;
  notes?: string | null;
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
    carregarLeads();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [searchTerm, selectedStatus, leads]);

  const carregarLeads = async () => {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar leads",
        description: error.message,
      });
    } else {
      setLeads(data || []);
    }
  };

  const filterLeads = () => {
    let filtered = leads;

    if (searchTerm) {
      filtered = filtered.filter(
        (lead) =>
          lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.phone?.includes(searchTerm) ||
          lead.company?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedStatus !== "all") {
      filtered = filtered.filter((lead) => lead.status === selectedStatus);
    }

    setFilteredLeads(filtered);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      novo: "bg-blue-500",
      contato: "bg-yellow-500",
      qualificado: "bg-green-500",
      proposta: "bg-purple-500",
      ganho: "bg-emerald-500",
      perdido: "bg-red-500",
    };
    return colors[status] || "bg-gray-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground">
            Gerencie todos os seus leads em um só lugar
          </p>
        </div>
        <div className="flex gap-2">
          <ImportarLeadsDialog onLeadsImported={carregarLeads} />
          <NovoLeadDialog onLeadCreated={carregarLeads} />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, telefone ou empresa..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={selectedStatus === "all" ? "default" : "outline"}
            onClick={() => setSelectedStatus("all")}
          >
            Todos
          </Button>
          <Button
            variant={selectedStatus === "novo" ? "default" : "outline"}
            onClick={() => setSelectedStatus("novo")}
          >
            Novos
          </Button>
          <Button
            variant={selectedStatus === "qualificado" ? "default" : "outline"}
            onClick={() => setSelectedStatus("qualificado")}
          >
            Qualificados
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredLeads.map((lead) => (
          <Card key={lead.id} className="transition-all hover:shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{lead.name}</h3>
                    <Badge className={getStatusColor(lead.status)}>
                      {lead.status}
                    </Badge>
                    {lead.source && (
                      <Badge variant="outline">
                        <Tag className="mr-1 h-3 w-3" />
                        {lead.source}
                      </Badge>
                    )}
                  </div>
                  
                  {lead.tags && lead.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {lead.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          <Tag className="h-3 w-3" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                    {lead.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {lead.email}
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {lead.phone}
                      </div>
                    )}
                    {lead.company && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{lead.company}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-xl font-bold text-primary">
                    R$ {Number(lead.value).toLocaleString("pt-BR")}
                  </div>
                  <div className="flex gap-2">
                    <LeadQuickActions 
                      leadId={lead.id} 
                      leadName={lead.name} 
                      leadPhone={lead.phone || lead.telefone || undefined}
                    />
                    <LeadTagsDialog 
                      leadId={lead.id}
                      currentTags={lead.tags}
                      onTagsUpdated={carregarLeads}
                      triggerButton={
                        <Button variant="outline" size="sm">
                          <Tag className="h-4 w-4 mr-2" />
                          Tags
                        </Button>
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredLeads.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Nenhum lead encontrado</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
