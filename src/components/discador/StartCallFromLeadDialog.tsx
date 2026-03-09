import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Phone, Search, User, Hash, Loader2, UserPlus, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ConversaPopup } from '@/components/leads/ConversaPopup';

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  telefone: string | null;
  email: string | null;
}

interface StartCallFromLeadDialogProps {
  open: boolean;
  onClose: () => void;
  onStartCall: (leadId: string, leadName: string, phoneNumber: string) => void;
}

// Cache company_id to avoid repeated auth calls
let cachedCompanyId: string | null = null;

const getCompanyId = async (): Promise<string | null> => {
  if (cachedCompanyId) return cachedCompanyId;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('company_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (userRole?.company_id) {
    cachedCompanyId = userRole.company_id;
  }
  return cachedCompanyId;
};

export const StartCallFromLeadDialog: React.FC<StartCallFromLeadDialogProps> = ({
  open,
  onClose,
  onStartCall
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [manualNumber, setManualNumber] = useState('');
  const [manualName, setManualName] = useState('');
  const [saveAsLead, setSaveAsLead] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('leads');
  const channelRef = useRef<any>(null);
  const [conversaPopupOpen, setConversaPopupOpen] = useState(false);
  const [selectedLeadForChat, setSelectedLeadForChat] = useState<{id: string; name: string; phone: string} | null>(null);

  // Load all leads (no limit) with real-time sync
  const loadLeads = useCallback(async () => {
    setIsLoading(true);
    try {
      const companyId = await getCompanyId();
      if (!companyId) return;

      const { data, error } = await supabase
        .from('leads')
        .select('id, name, phone, telefone, email')
        .eq('company_id', companyId)
        .order('name', { ascending: true });

      if (error) throw error;
      setLeads((data || []).filter(l => l.phone || l.telefone));
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Subscribe to real-time lead changes
  useEffect(() => {
    if (!open) return;

    loadLeads();

    const setupRealtime = async () => {
      const companyId = await getCompanyId();
      if (!companyId) return;

      channelRef.current = supabase
        .channel('discador-leads-sync')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'leads',
            filter: `company_id=eq.${companyId}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newLead = payload.new as Lead;
              if (newLead.phone || newLead.telefone) {
                setLeads(prev => [...prev, newLead].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
              }
            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as Lead;
              setLeads(prev => prev.map(l => l.id === updated.id ? updated : l).filter(l => l.phone || l.telefone));
            } else if (payload.eventType === 'DELETE') {
              const deleted = payload.old as { id: string };
              setLeads(prev => prev.filter(l => l.id !== deleted.id));
            }
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [open, loadLeads]);

  const filteredLeads = leads.filter(lead => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(term) ||
      lead.phone?.includes(term) ||
      lead.telefone?.includes(term) ||
      lead.email?.toLowerCase().includes(term)
    );
  });

  const handleSelectLead = (lead: Lead) => {
    const phoneNumber = lead.telefone || lead.phone || '';
    if (phoneNumber) {
      onStartCall(lead.id, lead.name, phoneNumber);
      onClose();
    }
  };

  const handleSendMessage = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    onClose();
    navigate(`/conversas?numero=${cleanPhone}`);
  };

  const handleManualCall = async () => {
    const cleanNumber = manualNumber.replace(/\D/g, '');
    if (cleanNumber.length < 10) return;

    let leadId = '';
    const contactName = manualName || cleanNumber;

    // Save as lead if checked
    if (saveAsLead) {
      setIsSaving(true);
      try {
        const companyId = await getCompanyId();
        if (!companyId) throw new Error('Empresa não encontrada');

        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error('Usuário não autenticado');

        // Check if lead with this phone already exists
        const { data: existing } = await supabase
          .from('leads')
          .select('id, name')
          .eq('company_id', companyId)
          .or(`telefone.eq.${cleanNumber},phone.eq.${cleanNumber}`)
          .maybeSingle();

        if (existing) {
          leadId = existing.id;
          toast.info(`Contato "${existing.name}" já existe no CRM`);
        } else {
          const { data: newLead, error } = await supabase
            .from('leads')
            .insert({
              name: contactName,
              telefone: cleanNumber,
              company_id: companyId,
              owner_id: userData.user.id,
              origem: 'Discador'
            })
            .select('id')
            .single();

          if (error) throw error;
          leadId = newLead.id;
          toast.success(`Contato "${contactName}" salvo no CRM`);
        }
      } catch (error: any) {
        console.error('Erro ao salvar contato:', error);
        toast.error('Erro ao salvar contato, mas a ligação continuará');
      } finally {
        setIsSaving(false);
      }
    }

    onStartCall(leadId, contactName, manualNumber);
    onClose();
  };

  const formatPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Fazer Ligação
          </DialogTitle>
          <DialogDescription>
            Selecione um lead ou digite um número para ligar
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="leads" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Contatos ({leads.length})
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Hash className="w-4 h-4" />
              Digitar Número
            </TabsTrigger>
          </TabsList>

          {/* Tab: Contatos do CRM */}
          <TabsContent value="leads" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-2 pr-4">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando contatos...
                  </div>
                ) : filteredLeads.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    {searchTerm ? 'Nenhum contato encontrado' : 'Nenhum contato com telefone cadastrado'}
                  </div>
                ) : (
                  filteredLeads.map((lead) => {
                    const phone = lead.telefone || lead.phone;
                    return (
                      <div
                        key={lead.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => handleSelectLead(lead)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{lead.name}</p>
                            <p className="text-sm text-muted-foreground">{phone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            title="Enviar mensagem"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendMessage(phone || '');
                            }}
                          >
                            <MessageSquare className="w-4 h-4 text-green-500" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Ligar">
                            <Phone className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Tab: Digitar Número */}
          <TabsContent value="manual" className="space-y-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Nome (opcional)</label>
                <Input
                  placeholder="Nome do contato..."
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Número de telefone *</label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={manualNumber}
                  onChange={(e) => setManualNumber(formatPhoneInput(e.target.value))}
                  className="text-lg tracking-wider"
                />
                <p className="text-xs text-muted-foreground">
                  Digite o DDD + número com 10 ou 11 dígitos
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="save-lead"
                  checked={saveAsLead}
                  onCheckedChange={(checked) => setSaveAsLead(checked === true)}
                />
                <label htmlFor="save-lead" className="text-sm text-foreground flex items-center gap-1.5 cursor-pointer">
                  <UserPlus className="w-3.5 h-3.5" />
                  Salvar contato no CRM
                </label>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => handleSendMessage(manualNumber)}
                  disabled={manualNumber.replace(/\D/g, '').length < 10}
                >
                  <MessageSquare className="w-4 h-4 mr-2 text-green-600" />
                  Enviar Mensagem
                </Button>
                <Button
                  className="flex-1"
                  size="lg"
                  onClick={handleManualCall}
                  disabled={manualNumber.replace(/\D/g, '').length < 10 || isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Phone className="w-4 h-4 mr-2" />
                  )}
                  Ligar
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};