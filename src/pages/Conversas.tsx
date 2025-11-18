import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConversaPopup } from "@/components/leads/ConversaPopup";

interface Conversa {
  id: string;
  numero: string;
  telefone_formatado: string;
  nome_contato: string;
  ultima_mensagem: string;
  created_at: string;
  status: string;
  origem: string;
}

export default function Conversas() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedConversa, setSelectedConversa] = useState<{ id: string; name: string; phone?: string } | null>(null);
  const [showConversaDialog, setShowConversaDialog] = useState(false);

  useEffect(() => {
    carregarConversas();
  }, []);

  const carregarConversas = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!userRole?.company_id) {
        toast.error("Usuário não está associado a uma empresa");
        return;
      }

      // Buscar conversas agrupadas por número de telefone
      const { data, error } = await supabase
        .from("conversas")
        .select("*")
        .eq("company_id", userRole.company_id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Agrupar conversas por telefone e pegar a última mensagem de cada uma
      const conversasAgrupadas = new Map<string, Conversa>();
      
      (data || []).forEach((conv: any) => {
        const telefone = conv.telefone_formatado || conv.numero;
        if (!conversasAgrupadas.has(telefone)) {
          conversasAgrupadas.set(telefone, {
            id: conv.id,
            numero: telefone,
            telefone_formatado: telefone,
            nome_contato: conv.nome_contato || telefone,
            ultima_mensagem: conv.mensagem || "",
            created_at: conv.created_at,
            status: conv.status || "recebida",
            origem: conv.origem || "WhatsApp",
          });
        }
      });

      setConversas(Array.from(conversasAgrupadas.values()));
    } catch (error: any) {
      console.error("Erro ao carregar conversas:", error);
      toast.error("Erro ao carregar conversas");
    } finally {
      setLoading(false);
    }
  };

  const conversasFiltradas = conversas.filter((conv) =>
    conv.nome_contato.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.numero.includes(searchTerm)
  );

  const abrirConversa = async (conversa: Conversa) => {
    // Tentar encontrar o lead pelo telefone
    const telefoneLimpo = conversa.telefone_formatado.replace(/\D/g, "");
    
    try {
      // Buscar lead pelo telefone
      const { data: lead } = await supabase
        .from("leads")
        .select("id, name, phone, telefone")
        .or(`phone.ilike.%${telefoneLimpo}%,telefone.ilike.%${telefoneLimpo}%`)
        .limit(1)
        .single();

      if (lead) {
        setSelectedConversa({
          id: lead.id,
          name: lead.name || conversa.nome_contato,
          phone: lead.phone || lead.telefone || conversa.numero,
        });
      } else {
        // Se não encontrar lead, criar um temporário
        setSelectedConversa({
          id: conversa.id,
          name: conversa.nome_contato,
          phone: conversa.numero,
        });
      }
    } catch {
      // Se não encontrar lead, usar dados da conversa
      setSelectedConversa({
        id: conversa.id,
        name: conversa.nome_contato,
        phone: conversa.numero,
      });
    }
    
    setShowConversaDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Conversas</h1>
          <p className="text-muted-foreground">
            Gerencie todas as suas conversas do WhatsApp
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Carregando conversas...</p>
            </div>
          ) : conversasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground">
                {searchTerm ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversasFiltradas.map((conversa) => (
                <Card
                  key={conversa.id}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => abrirConversa(conversa)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{conversa.nome_contato}</h3>
                        <p className="text-sm text-muted-foreground">
                          {conversa.numero}
                        </p>
                        {conversa.ultima_mensagem && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {conversa.ultima_mensagem}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {new Date(conversa.created_at).toLocaleDateString("pt-BR")}
                        </p>
                        <Badge
                          variant={
                            conversa.status === "Enviada" ? "default" : "secondary"
                          }
                          className="mt-1"
                        >
                          {conversa.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Conversa */}
      {selectedConversa && selectedConversa.id && (
        <ConversaPopup
          open={showConversaDialog}
          onOpenChange={(open) => {
            setShowConversaDialog(open);
            if (!open) {
              setSelectedConversa(null);
            }
          }}
          leadId={selectedConversa.id}
          leadName={selectedConversa.name || "Contato sem nome"}
          leadPhone={selectedConversa.phone || undefined}
        />
      )}
    </div>
  );
}

