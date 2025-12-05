import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ResponsaveisManagerProps {
  leadId: string | null;
  responsaveisAtuais?: string[];
  onResponsaveisUpdated: (responsaveis: string[]) => void;
}

export function ResponsaveisManager({ 
  leadId, 
  responsaveisAtuais = [],
  onResponsaveisUpdated 
}: ResponsaveisManagerProps) {
  const [open, setOpen] = useState(false);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [novoResponsavel, setNovoResponsavel] = useState("");
  const [responsaveis, setResponsaveis] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Função para verificar se é UUID
  const isUUID = (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Converter UUIDs para nomes quando responsaveisAtuais mudar
  useEffect(() => {
    const convertToNames = async () => {
      if (!responsaveisAtuais || responsaveisAtuais.length === 0) {
        setResponsaveis([]);
        return;
      }

      // Verificar se são UUIDs
      const uuids = responsaveisAtuais.filter(isUUID);
      const names = responsaveisAtuais.filter(r => !isUUID(r));

      if (uuids.length === 0) {
        // Não há UUIDs, usar os nomes diretamente
        setResponsaveis(responsaveisAtuais);
        return;
      }

      // Buscar nomes dos UUIDs
      try {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', uuids);

        if (profiles) {
          const convertedNames = uuids.map(uuid => {
            const profile = profiles.find(p => p.id === uuid);
            return profile?.full_name || profile?.email || uuid;
          });
          setResponsaveis([...names, ...convertedNames]);
        } else {
          setResponsaveis(responsaveisAtuais);
        }
      } catch (error) {
        console.error('Erro ao converter UUIDs para nomes:', error);
        setResponsaveis(responsaveisAtuais);
      }
    };

    convertToNames();
  }, [responsaveisAtuais]);

  useEffect(() => {
    if (open) {
      carregarUsuarios();
    }
  }, [open]);

  const carregarUsuarios = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Buscar usuários da mesma empresa
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!userRole?.company_id) return;

      // Buscar IDs dos usuários da empresa
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("company_id", userRole.company_id);

      if (!userRoles || userRoles.length === 0) return;

      const userIds = userRoles.map(ur => ur.user_id);

      // Buscar perfis dos usuários
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in('id', userIds);

      if (profiles) {
        setUsuarios(profiles);
      }
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    }
  };

  const adicionarResponsavel = async () => {
    if (!novoResponsavel) {
      toast.error("Selecione um responsável");
      return;
    }

    const usuario = usuarios.find(u => u.id === novoResponsavel);
    if (!usuario) return;

    const nomeResponsavel = usuario.full_name || usuario.email;

    if (responsaveis.includes(nomeResponsavel)) {
      toast.error("Este responsável já foi adicionado");
      return;
    }

    const novosResponsaveis = [...responsaveis, nomeResponsavel];
    setResponsaveis(novosResponsaveis);
    
    // Se tem leadId, salvar no banco
    if (leadId) {
      setLoading(true);
      try {
        const { error } = await supabase
          .from("leads")
          .update({ 
            notes: `Responsáveis: ${novosResponsaveis.join(', ')}`
          })
          .eq("id", leadId);

        if (error) throw error;

        console.log('✅ Responsável adicionado:', nomeResponsavel);
        toast.success(`${nomeResponsavel} adicionado como responsável`);
      } catch (error) {
        console.error("Erro ao salvar responsável:", error);
        toast.error("Erro ao adicionar responsável");
      } finally {
        setLoading(false);
      }
    }

    onResponsaveisUpdated(novosResponsaveis);
    setNovoResponsavel("");
  };

  const removerResponsavel = async (nome: string) => {
    const novosResponsaveis = responsaveis.filter(r => r !== nome);
    setResponsaveis(novosResponsaveis);

    // Se tem leadId, salvar no banco
    if (leadId) {
      setLoading(true);
      try {
        const { error } = await supabase
          .from("leads")
          .update({ 
            notes: novosResponsaveis.length > 0 
              ? `Responsáveis: ${novosResponsaveis.join(', ')}`
              : ''
          })
          .eq("id", leadId);

        if (error) throw error;

        console.log('🗑️ Responsável removido:', nome);
        toast.success(`${nome} removido dos responsáveis`);
      } catch (error) {
        console.error("Erro ao remover responsável:", error);
        toast.error("Erro ao remover responsável");
      } finally {
        setLoading(false);
      }
    }

    onResponsaveisUpdated(novosResponsaveis);
  };

  return (
    <div>
      <h4 className="text-foreground font-medium mb-2 flex items-center gap-2">
        <Users className="h-4 w-4" /> 
        Responsáveis {responsaveis.length > 0 && `(${responsaveis.length})`}
      </h4>
      
      <div className="flex flex-wrap gap-2 mb-3 min-h-[40px]">
        {responsaveis.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum responsável atribuído</p>
        ) : (
          responsaveis.map((nome, index) => (
            <Badge 
              key={`${nome}-${index}`} 
              variant="secondary" 
              className="gap-2 py-1.5 pr-1"
            >
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {nome.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">{nome}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 p-0 hover:bg-destructive/20 hover:text-destructive rounded-full"
                onClick={() => removerResponsavel(nome)}
                disabled={loading}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="w-full">
            <UserPlus className="h-3 w-3 mr-2" /> 
            Adicionar Responsável
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Responsável</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Responsáveis podem visualizar e responder a conversa
            </p>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Select 
                value={novoResponsavel} 
                onValueChange={setNovoResponsavel}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map((usuario) => (
                    <SelectItem key={usuario.id} value={usuario.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {(usuario.full_name || usuario.email).charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{usuario.full_name || usuario.email}</p>
                          {usuario.full_name && (
                            <p className="text-xs text-muted-foreground">{usuario.email}</p>
                          )}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button 
                onClick={adicionarResponsavel}
                disabled={loading || !novoResponsavel}
                className="flex-1"
              >
                {loading ? "Adicionando..." : "Adicionar"}
              </Button>
            </div>
          </div>

          {responsaveis.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Responsáveis atuais:
              </p>
              <div className="flex flex-wrap gap-2">
                {responsaveis.map((nome, index) => (
                  <Badge 
                    key={`current-${nome}-${index}`} 
                    variant="outline" 
                    className="text-xs"
                  >
                    {nome}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {responsaveis.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          💡 Todos podem visualizar e responder esta conversa
        </p>
      )}
    </div>
  );
}
