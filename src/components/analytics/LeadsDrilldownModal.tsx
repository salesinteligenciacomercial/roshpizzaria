import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { 
  Users, DollarSign, Search, ExternalLink, Download, Phone, Mail, 
  Building2, Eye, MessageSquare, ArrowUpRight, Loader2, ChevronLeft, ChevronRight 
} from "lucide-react";
import { toast } from "sonner";
import { ConversaPopup } from "@/components/leads/ConversaPopup";

export type DrilldownFilterType = 
  | 'total' 
  | 'pipeline' 
  | 'active' 
  | 'won' 
  | 'lost' 
  | 'conversations' 
  | 'appointments' 
  | 'tasks';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  value: number | null;
  status: string | null;
  created_at: string;
  etapa_nome?: string;
  funil_nome?: string;
}

interface LeadsDrilldownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  filterType: DrilldownFilterType;
  userCompanyId: string | null;
  globalFilters: {
    period: string;
  };
}

const ITEMS_PER_PAGE = 10;

export default function LeadsDrilldownModal({
  open,
  onOpenChange,
  title,
  description,
  filterType,
  userCompanyId,
  globalFilters
}: LeadsDrilldownModalProps) {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  
  // Estado para popup de conversa
  const [conversaPopupOpen, setConversaPopupOpen] = useState(false);
  const [selectedLeadForConversation, setSelectedLeadForConversation] = useState<Lead | null>(null);

  const fetchLeads = useCallback(async () => {
    if (!userCompanyId || !open) return;

    setLoading(true);
    try {
      // Calculate date filter
      let startDate: Date | null = null;
      if (globalFilters.period !== 'all') {
        const now = new Date();
        switch (globalFilters.period) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'quarter':
            const quarterStart = Math.floor(now.getMonth() / 3) * 3;
            startDate = new Date(now.getFullYear(), quarterStart, 1);
            break;
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        }
      }

      let query = supabase
        .from("leads")
        .select(`
          id, 
          name, 
          email, 
          phone, 
          company, 
          value, 
          status, 
          created_at,
          etapas!left(nome),
          funis!left(nome)
        `)
        .eq('company_id', userCompanyId);

      // Apply date filter
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      // Apply filter based on type
      switch (filterType) {
        case 'pipeline':
          query = query
            .gt('value', 0)
            .not('status', 'eq', 'ganho')
            .not('status', 'eq', 'perdido');
          break;
        case 'active':
          query = query
            .not('status', 'in', '(ganho,perdido)');
          break;
        case 'won':
          query = query.eq('status', 'ganho');
          break;
        case 'lost':
          query = query.eq('status', 'perdido');
          break;
        // 'total' - no additional filters
      }

      const { data, error } = await query
        .order('value', { ascending: false, nullsFirst: false })
        .limit(500);

      if (error) throw error;

      const formattedLeads = (data || []).map((lead: any) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        value: lead.value,
        status: lead.status,
        created_at: lead.created_at,
        etapa_nome: lead.etapas?.nome,
        funil_nome: lead.funis?.nome
      }));

      setLeads(formattedLeads);
      setFilteredLeads(formattedLeads);
      setCurrentPage(1);
    } catch (error) {
      console.error('[LeadsDrilldown] Error fetching leads:', error);
      toast.error('Erro ao carregar leads');
    } finally {
      setLoading(false);
    }
  }, [userCompanyId, filterType, globalFilters, open]);

  useEffect(() => {
    if (open) {
      fetchLeads();
      setSearchQuery("");
    }
  }, [open, fetchLeads]);

  // Filter leads by search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredLeads(leads);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = leads.filter(lead => 
        lead.name?.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.phone?.includes(query) ||
        lead.company?.toLowerCase().includes(query)
      );
      setFilteredLeads(filtered);
    }
    setCurrentPage(1);
  }, [searchQuery, leads]);

  // Calculate totals
  const totalValue = filteredLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);
  const totalLeads = filteredLeads.length;

  // Pagination
  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string | null) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      novo: { label: 'Novo', variant: 'secondary' },
      ganho: { label: 'Ganho', variant: 'default' },
      perdido: { label: 'Perdido', variant: 'destructive' },
      em_andamento: { label: 'Em Andamento', variant: 'outline' }
    };
    const config = statusConfig[status || 'novo'] || { label: status || 'N/A', variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleExportCSV = () => {
    const headers = ['Nome', 'Email', 'Telefone', 'Empresa', 'Valor', 'Status', 'Etapa', 'Funil', 'Data Criação'];
    const rows = filteredLeads.map(lead => [
      lead.name,
      lead.email || '',
      lead.phone || '',
      lead.company || '',
      lead.value?.toString() || '0',
      lead.status || '',
      lead.etapa_nome || '',
      lead.funil_nome || '',
      formatDate(lead.created_at)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `leads_${filterType}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Exportação concluída');
  };

  const handleViewInLeads = () => {
    onOpenChange(false);
    // Navigate to leads with filter
    const params = new URLSearchParams();
    if (filterType === 'won') params.set('status', 'ganho');
    if (filterType === 'lost') params.set('status', 'perdido');
    if (filterType === 'pipeline') params.set('minValue', '1');
    navigate(`/leads${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleOpenConversation = (lead: Lead) => {
    if (!lead.phone) {
      toast.error('Lead sem telefone cadastrado');
      return;
    }
    setSelectedLeadForConversation(lead);
    setConversaPopupOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Users className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Stats Summary */}
        <div className="flex flex-wrap gap-4 py-3 px-1 border-b">
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{totalLeads} leads</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg">
            <DollarSign className="h-4 w-4 text-success" />
            <span className="text-sm font-medium">{formatCurrency(totalValue)}</span>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row gap-3 py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email, telefone ou empresa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1" />
              Exportar
            </Button>
            <Button variant="default" size="sm" onClick={handleViewInLeads}>
              <ExternalLink className="h-4 w-4 mr-1" />
              Ver em Leads
            </Button>
          </div>
        </div>

        {/* Leads Table */}
        <ScrollArea className="flex-1 min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : paginatedLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Users className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">Nenhum lead encontrado</p>
              <p className="text-sm">Tente ajustar os filtros ou período</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Contato</TableHead>
                  <TableHead className="hidden lg:table-cell">Empresa</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.map((lead) => (
                  <TableRow key={lead.id} className="group">
                    <TableCell>
                      <div className="font-medium">{lead.name}</div>
                      {lead.etapa_nome && (
                        <div className="text-xs text-muted-foreground">{lead.etapa_nome}</div>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="space-y-1">
                        {lead.phone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {lead.phone}
                          </div>
                        )}
                        {lead.email && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span className="truncate max-w-[150px]">{lead.email}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {lead.company && (
                        <div className="flex items-center gap-1 text-sm">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[120px]">{lead.company}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {lead.value ? formatCurrency(lead.value) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(lead.status)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(`/leads`)}
                          title="Ver lead"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {lead.phone && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenConversation(lead)}
                            title="Abrir conversa"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredLeads.length)} de {filteredLeads.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Popup de Conversa */}
      {selectedLeadForConversation && (
        <ConversaPopup
          open={conversaPopupOpen}
          onOpenChange={(isOpen) => {
            setConversaPopupOpen(isOpen);
            if (!isOpen) setSelectedLeadForConversation(null);
          }}
          leadId={selectedLeadForConversation.id}
          leadName={selectedLeadForConversation.name}
          leadPhone={selectedLeadForConversation.phone || undefined}
        />
      )}
    </Dialog>
  );
}
