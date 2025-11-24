import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AgendaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: {
    id: string;
    nome: string;
    telefone?: string;
  };
  onAgendamentoCriado?: () => void;
}

export function AgendaModal({ open, onOpenChange, lead, onAgendamentoCriado }: AgendaModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    descricao: "",
    data_hora_inicio: "",
    data_hora_fim: "",
    tipo_servico: "reuniao",
    observacoes: "",
    custo_estimado: "",
    enviar_confirmacao: false,
    notificar_responsavel: true,
    enviar_lembrete: true,
    horas_antecedencia: "",
    horas_antecedencia_horas: "1",
    horas_antecedencia_minutos: "0",
    destinatario_lembrete: "lead" as "lead" | "responsavel" | "ambos"
  });

  // Função para normalizar telefone brasileiro
  const normalizePhoneBR = (phone: string): string | null => {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) return null;
    if (cleaned.length === 10) return `55${cleaned}`;
    if (cleaned.length === 11) return `55${cleaned}`;
    if (cleaned.startsWith("55") && cleaned.length === 13) return cleaned;
    if (cleaned.startsWith("55") && cleaned.length === 12) return cleaned;
    return cleaned;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.tipo_servico.trim()) {
      toast.error("Selecione o tipo de serviço");
      return;
    }

    if (!formData.data_hora_inicio || !formData.data_hora_fim) {
      toast.error("Selecione a data e hora do compromisso");
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Converter datas para ISO e validar
      const inicio = new Date(formData.data_hora_inicio);
      const fim = new Date(formData.data_hora_fim);
      if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
        toast.error("Datas inválidas");
        return;
      }
      if (fim <= inicio) {
        toast.error("Data/hora fim deve ser após o início");
        return;
      }

      const inicioISO = inicio.toISOString();
      const fimISO = fim.toISOString();

      // Buscar company_id do usuário - VALIDAÇÃO CRÍTICA
      console.log('🔍 [AgendaModal] Buscando company_id para usuário:', session.user.id);
      
      const { data: userRole, error: userRoleError } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (userRoleError || !userRole) {
        console.error('❌ [AgendaModal] Erro ao buscar user_role:', userRoleError);
        toast.error("Erro: Usuário não está associado a uma empresa.");
        return;
      }

      if (!userRole.company_id) {
        console.error('❌ [AgendaModal] company_id não encontrado no user_role');
        toast.error("Erro: Não foi possível identificar a empresa do usuário.");
        return;
      }

      console.log('✅ [AgendaModal] company_id obtido:', userRole.company_id);
      
      const companyId = userRole.company_id;

      // Criar compromisso e obter o id
      // Combinar descrição com observações já que não existe campo título
      const observacoesCompletas = formData.descricao 
        ? `${formData.descricao}${formData.observacoes ? '\n\n' + formData.observacoes : ''}`
        : formData.observacoes;

      const insertPayload: any = {
        data_hora_inicio: inicioISO,
        data_hora_fim: fimISO,
        tipo_servico: formData.tipo_servico?.trim() || 'reuniao',
        observacoes: observacoesCompletas,
        custo_estimado: formData.custo_estimado ? parseFloat(formData.custo_estimado) : null,
        lead_id: lead.id,
        owner_id: session.user.id,
        usuario_responsavel_id: session.user.id,
        status: "agendado"
      };
      if (companyId) insertPayload.company_id = companyId;

      const { data: compromissoCriado, error } = await supabase
        .from("compromissos")
        .insert(insertPayload)
        .select('id')
        .single();

      if (error) throw error;

      console.log('✅ [AgendaModal] Compromisso criado com sucesso:', compromissoCriado?.id);
      console.log('📋 [AgendaModal] Opções selecionadas:', {
        enviar_confirmacao: formData.enviar_confirmacao,
        notificar_responsavel: formData.notificar_responsavel,
        enviar_lembrete: formData.enviar_lembrete,
        lead_telefone: lead.telefone
      });

      // ⚡ CRIAR LEMBRETE AUTOMATICAMENTE PARA TODO COMPROMISSO (OBRIGATÓRIO)
      if (compromissoCriado) {
        console.log('📝 [LEMBRETE] Criando lembrete automaticamente para compromisso:', compromissoCriado.id);
        
        try {
          // Processar tempo de antecedência (usar valores do formulário ou padrão)
          let horas = parseInt(formData.horas_antecedencia_horas || "0", 10);
          let minutos = parseInt(formData.horas_antecedencia_minutos || "0", 10);
          
          // Se não informado ou inválido, usar valores padrão (1 hora antes)
          if (horas === 0 && minutos === 0) {
            console.log('ℹ️ [LEMBRETE] Usando valores padrão: 1 hora de antecedência');
            horas = 1;
            minutos = 0;
          }
          
          // Validar valores
          if (horas < 0) horas = 1;
          if (minutos < 0 || minutos >= 60) minutos = 0;

          // Converter horas e minutos para formato decimal (garantir precisão)
          const tempoAntecedencia = parseFloat((horas + (minutos / 60)).toFixed(4));

          // Calcular data de envio do lembrete baseada na data do compromisso
          const dataEnvio = new Date(inicio);
          dataEnvio.setTime(dataEnvio.getTime() - (tempoAntecedencia * 60 * 60 * 1000));

          // Mensagem personalizada do lembrete
          const mensagemLembrete = `Olá ${lead.nome}! Lembramos do seu compromisso agendado para ${format(inicio, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.`;

          // Normalizar telefone do lead para garantir formato correto
          const telefoneLead = lead.telefone ? normalizePhoneBR(lead.telefone) : null;
          
          console.log('📞 [LEMBRETE] Telefone do lead normalizado:', {
            original: lead.telefone,
            normalizado: telefoneLead,
            destinatario: formData.destinatario_lembrete || 'lead'
          });

          // LÓGICA DE DESTINATÁRIO:
          // - Quando destinatario='lead': salvar telefone do lead em telefone_responsavel
          // - Quando destinatario='responsavel': telefone_responsavel fica null (será buscado na edge function)
          // - Quando destinatario='ambos': salvar telefone do responsável (lead será buscado via compromisso)
          const destinatarioLembrete = formData.destinatario_lembrete || 'lead';
          let telefoneParaLembrete = null;
          
          if (destinatarioLembrete === 'lead') {
            // Para lead, salvar diretamente o telefone normalizado
            telefoneParaLembrete = telefoneLead;
          }
          // Para 'responsavel' e 'ambos', o telefone do responsável será buscado dinamicamente na edge function

          const lembreteData = {
            compromisso_id: compromissoCriado.id,
            canal: 'whatsapp',
            horas_antecedencia: tempoAntecedencia,
            mensagem: mensagemLembrete,
            status_envio: 'pendente',
            data_envio: dataEnvio.toISOString(),
            destinatario: destinatarioLembrete,
            telefone_responsavel: telefoneParaLembrete,
            company_id: companyId,
          };

          console.log('📝 [LEMBRETE] Dados do lembrete:', { 
            compromisso_id: lembreteData.compromisso_id,
            data_envio: lembreteData.data_envio,
            horas_antecedencia: lembreteData.horas_antecedencia,
            destinatario: lembreteData.destinatario,
            telefone_salvo: lembreteData.telefone_responsavel,
            telefone_lead_disponivel: telefoneLead,
            data_compromisso: inicio.toISOString()
          });

          // Criar lembrete de forma síncrona e garantida
          let lembreteCriado = null;
          let lembreteError = null;
          
          // Tentar inserir com valor decimal
          const resultado = await supabase
            .from('lembretes')
            .insert(lembreteData)
            .select()
            .single();
          
          lembreteCriado = resultado.data;
          lembreteError = resultado.error;

          // Se erro for de tipo INTEGER, tentar novamente arredondando para inteiro (fallback temporário)
          if (lembreteError && (lembreteError.message?.includes('integer') || lembreteError.message?.includes('INTEGER'))) {
            console.warn('⚠️ [LEMBRETE] Erro de tipo INTEGER detectado, tentando com valor arredondado (fallback)...');
            
            // Criar novo objeto com valor arredondado para inteiro (horas completas)
            const lembreteDataFallback = {
              ...lembreteData,
              horas_antecedencia: Math.round(tempoAntecedencia) || 1, // Arredondar para horas completas
            };
            
            // Recalcular data de envio com valor arredondado
            const dataEnvioFallback = new Date(inicio);
            dataEnvioFallback.setTime(dataEnvioFallback.getTime() - (lembreteDataFallback.horas_antecedencia * 60 * 60 * 1000));
            lembreteDataFallback.data_envio = dataEnvioFallback.toISOString();
            
            console.log('🔄 [LEMBRETE] Tentando novamente com valor arredondado:', lembreteDataFallback.horas_antecedencia);
            
            const retryResult = await supabase
              .from('lembretes')
              .insert(lembreteDataFallback)
              .select()
              .single();
            
            lembreteCriado = retryResult.data;
            lembreteError = retryResult.error;
            
            if (!lembreteError) {
              console.log('✅ [LEMBRETE] Lembrete criado com valor arredondado (fallback temporário)');
              toast.warning(
                `Lembrete criado com ${lembreteDataFallback.horas_antecedencia} hora(s) de antecedência (arredondado). Para usar minutos, execute a migração SQL.`,
                { duration: 8000 }
              );
            }
          }

          if (lembreteError) {
            console.error('❌ [LEMBRETE] Erro ao criar lembrete:', lembreteError);
            console.error('❌ [LEMBRETE] Dados que causaram erro:', {
              compromisso_id: lembreteData.compromisso_id,
              horas_antecedencia: lembreteData.horas_antecedencia,
              tipo_horas_antecedencia: typeof lembreteData.horas_antecedencia,
              erro_completo: JSON.stringify(lembreteError, null, 2)
            });
            
            toast.error(
              `Erro ao criar lembrete. Execute o SQL em APLICAR_MIGRACAO_LEMBRETES.sql no Supabase Dashboard para corrigir.`,
              { duration: 10000 }
            );
          } else {
            console.log('✅ [LEMBRETE] Lembrete criado automaticamente e sincronizado:', lembreteCriado?.id);
            console.log('📅 [LEMBRETE] Data de envio calculada:', dataEnvio.toISOString());
            console.log('📅 [LEMBRETE] Data do compromisso:', inicio.toISOString());
            console.log('⏰ [LEMBRETE] Antecedência:', tempoAntecedencia, 'horas');
            console.log('🔗 [LEMBRETE] Vinculado ao compromisso:', compromissoCriado.id);
          }
        } catch (error: any) {
          console.error('❌ [LEMBRETE] Erro ao criar lembrete:', error);
          toast.error(`Erro ao criar lembrete: ${error?.message || 'Erro desconhecido'}`);
          // Não lançar erro para não impedir o compromisso
        }
      }

      // Enviar mensagem de confirmação imediata se solicitado
      if (formData.enviar_confirmacao && compromissoCriado && lead.telefone) {
        console.log('📱 [AgendaModal] Iniciando envio de confirmação...');
        try {
          const telefone = normalizePhoneBR(lead.telefone);
          if (telefone) {
            // Mensagem de confirmação formatada e personalizada
            const tipoServicoFormatado = formData.tipo_servico?.trim()
              ? formData.tipo_servico.charAt(0).toUpperCase() + formData.tipo_servico.slice(1)
              : null;
            const mensagemConfirmacao = `✅ *Compromisso Confirmado!*\n\n` +
              `Olá ${lead.nome}! Seu compromisso foi agendado com sucesso.\n\n` +
              `📅 *Data:* ${format(inicio, "dd/MM/yyyy", { locale: ptBR })}\n` +
              `🕐 *Horário:* ${format(inicio, "HH:mm", { locale: ptBR })} às ${format(fim, "HH:mm", { locale: ptBR })}\n` +
              (tipoServicoFormatado ? `📋 *Tipo:* ${tipoServicoFormatado}\n` : '') +
              (formData.descricao || formData.observacoes ? `\n💬 *Observações:*\n${formData.descricao || ''}${formData.descricao && formData.observacoes ? '\n' : ''}${formData.observacoes || ''}\n` : '') +
              `\n✅ *Status:* Agendado\n\n` +
              `Aguardamos você no dia e horário agendados!\n\n` +
              `_Esta é uma confirmação automática do seu agendamento._`;

            console.log('📱 [CONFIRMAÇÃO] Enviando mensagem de confirmação imediata...');
            
            const { error: confirmacaoError } = await supabase.functions.invoke('enviar-whatsapp', {
              body: {
                numero: telefone,
                mensagem: mensagemConfirmacao,
                company_id: companyId
              }
            });

            if (confirmacaoError) {
              console.error('❌ [CONFIRMAÇÃO] Erro ao enviar confirmação:', confirmacaoError);
              toast.warning("Compromisso criado, mas não foi possível enviar a confirmação imediata.");
            } else {
              console.log('✅ [CONFIRMAÇÃO] Mensagem de confirmação enviada com sucesso!');
              
              // Salvar mensagem de confirmação na tabela conversas para ficar visível no CRM
              try {
                const { error: dbError } = await supabase.from('conversas').insert([{
                  numero: telefone,
                  telefone_formatado: telefone,
                  mensagem: mensagemConfirmacao,
                  origem: 'WhatsApp',
                  status: 'Enviada',
                  tipo_mensagem: 'text',
                  nome_contato: lead.nome,
                  company_id: companyId,
                  lead_id: lead.id,
                  fromme: true,
                }]);
                
                if (dbError) {
                  console.error('❌ [CONFIRMAÇÃO] Erro ao salvar mensagem no banco:', dbError);
                } else {
                  console.log('✅ [CONFIRMAÇÃO] Mensagem salva no banco de dados com sucesso!');
                }
              } catch (saveError) {
                console.error('❌ [CONFIRMAÇÃO] Erro ao salvar mensagem no banco:', saveError);
              }
            }
          }
        } catch (error) {
          console.error('❌ [CONFIRMAÇÃO] Erro ao enviar confirmação:', error);
          toast.warning("Compromisso criado, mas houve erro ao enviar a confirmação.");
        }
      }

      // Enviar notificação push para o responsável se solicitado
      if (formData.notificar_responsavel && compromissoCriado) {
        console.log('🔔 [AgendaModal] Iniciando envio de notificação push...');
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            const tipoServicoNotif = formData.tipo_servico || 'Compromisso';
            const mensagemNotificacao = `Novo compromisso agendado: ${tipoServicoNotif}\n` +
              `${format(inicio, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`;

            new Notification('Novo Compromisso Agendado', {
              body: mensagemNotificacao,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              tag: `compromisso-${compromissoCriado.id}`,
              requireInteraction: false,
            });

            console.log('🔔 [NOTIFICAÇÃO] Notificação push enviada ao responsável');
          } else if ('Notification' in window && Notification.permission !== 'denied') {
            // Solicitar permissão se ainda não foi solicitada
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              const tipoServicoNotif = formData.tipo_servico || 'Compromisso';
              const mensagemNotificacao = `Novo compromisso agendado: ${tipoServicoNotif}\n` +
                `${format(inicio, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`;

              new Notification('Novo Compromisso Agendado', {
                body: mensagemNotificacao,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: `compromisso-${compromissoCriado.id}`,
              });

              console.log('🔔 [NOTIFICAÇÃO] Permissão concedida e notificação enviada');
            }
          }
        } catch (error) {
          console.error('❌ [NOTIFICAÇÃO] Erro ao enviar notificação push:', error);
          // Não mostrar erro ao usuário, pois é opcional
        }
      }

      // Lembrete já foi criado acima, logo após o compromisso

      // Mensagem de sucesso mais informativa
      if (formData.enviar_confirmacao && formData.notificar_responsavel) {
        toast.success("Compromisso criado! Confirmação enviada e você foi notificado.");
      } else if (formData.enviar_confirmacao) {
        toast.success("Compromisso criado e confirmação enviada ao cliente!");
      } else if (formData.notificar_responsavel) {
        toast.success("Compromisso criado e você foi notificado!");
      } else {
        toast.success("Compromisso agendado com sucesso!");
      }

      onOpenChange(false);
      onAgendamentoCriado?.();

      // Limpar formulário
      setFormData({
        descricao: "",
        data_hora_inicio: "",
        data_hora_fim: "",
        tipo_servico: "reuniao",
        observacoes: "",
        custo_estimado: "",
        enviar_confirmacao: false,
        notificar_responsavel: true,
        enviar_lembrete: true,
        horas_antecedencia: "",
        horas_antecedencia_horas: "1",
        horas_antecedencia_minutos: "0",
        destinatario_lembrete: "lead"
      });
    } catch (error: any) {
      console.error("Erro ao criar compromisso:", error);
      toast.error(error?.message || "Erro ao agendar compromisso");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3">
          <DialogTitle>Agendar Compromisso</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tipo_servico" className="text-sm">Tipo de Serviço *</Label>
              <Select
                value={formData.tipo_servico}
                onValueChange={(value) => setFormData({ ...formData, tipo_servico: value })}
                required
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reuniao">Reunião</SelectItem>
                  <SelectItem value="apresentacao">Apresentação</SelectItem>
                  <SelectItem value="visita">Visita</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="custo_estimado" className="text-sm">Custo Estimado (R$)</Label>
              <Input
                id="custo_estimado"
                type="number"
                step="0.01"
                value={formData.custo_estimado}
                onChange={(e) => setFormData({ ...formData, custo_estimado: e.target.value })}
                placeholder="0.00"
                className="h-9"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="descricao" className="text-sm">Descrição</Label>
            <Input
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Ex: Apresentação do produto para cliente"
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="data_hora_inicio" className="text-sm">Data/Hora Início *</Label>
              <Input
                id="data_hora_inicio"
                type="datetime-local"
                value={formData.data_hora_inicio}
                onChange={(e) => setFormData({ ...formData, data_hora_inicio: e.target.value })}
                required
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="data_hora_fim" className="text-sm">Data/Hora Fim *</Label>
              <Input
                id="data_hora_fim"
                type="datetime-local"
                value={formData.data_hora_fim}
                onChange={(e) => setFormData({ ...formData, data_hora_fim: e.target.value })}
                required
                className="h-9"
              />
            </div>
          </div>


          <div>
            <Label htmlFor="observacoes" className="text-sm">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Informações adicionais..."
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Opções de Notificação */}
          <div className="space-y-3 pt-2 border-t">
            {/* Enviar Lembrete */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-1">
                <Label className="text-sm">Enviar lembrete automático</Label>
                <p className="text-xs text-muted-foreground">
                  O cliente receberá um lembrete via WhatsApp
                </p>
              </div>
              <Switch 
                checked={formData.enviar_lembrete}
                onCheckedChange={(checked) => setFormData({ ...formData, enviar_lembrete: checked })}
              />
            </div>

            {/* Configurações de Lembrete */}
            {formData.enviar_lembrete && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm">Enviar lembrete para</Label>
                  <Select 
                    value={formData.destinatario_lembrete} 
                    onValueChange={(value: "lead" | "responsavel" | "ambos") => setFormData({ ...formData, destinatario_lembrete: value })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Apenas o Lead</SelectItem>
                      <SelectItem value="responsavel">Apenas o Responsável</SelectItem>
                      <SelectItem value="ambos">Lead e Responsável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Tempo de antecedência</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground mb-1 block">Horas</Label>
                      <Select
                        value={formData.horas_antecedencia_horas}
                        onValueChange={(value) => {
                          setFormData({ ...formData, horas_antecedencia_horas: value });
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 25 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i} {i === 1 ? 'hora' : 'horas'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground mb-1 block">Minutos</Label>
                      <Select
                        value={formData.horas_antecedencia_minutos}
                        onValueChange={(value) => {
                          setFormData({ ...formData, horas_antecedencia_minutos: value });
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 5, 10, 15, 20, 30, 45].map((min) => (
                            <SelectItem key={min} value={min.toString()}>
                              {min} {min === 1 ? 'minuto' : 'minutos'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selecione quantas horas e minutos antes do compromisso o lembrete deve ser enviado.
                  </p>
                </div>
              </>
            )}

            {/* Enviar Confirmação Imediata */}
            {lead.telefone && (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                <div className="space-y-1">
                  <Label className="text-sm">Enviar confirmação imediata</Label>
                  <p className="text-xs text-muted-foreground">
                    O cliente receberá uma mensagem de confirmação via WhatsApp agora
                  </p>
                </div>
                <Switch 
                  checked={formData.enviar_confirmacao}
                  onCheckedChange={(checked) => setFormData({ ...formData, enviar_confirmacao: checked })}
                />
              </div>
            )}

            {/* Notificação Push para Responsável */}
            <div className="flex items-center justify-between p-3 border rounded-lg bg-green-50/50 dark:bg-green-950/20">
              <div className="space-y-1">
                <Label className="text-sm">Notificar responsável</Label>
                <p className="text-xs text-muted-foreground">
                  {('Notification' in window && Notification.permission === 'granted') 
                    ? 'Você receberá uma notificação push no navegador'
                    : 'Você receberá uma notificação push (permissão será solicitada)'}
                </p>
                {('Notification' in window && Notification.permission === 'denied') && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ Notificações bloqueadas. Ative nas configurações do navegador.
                  </p>
                )}
              </div>
              <Switch 
                checked={formData.notificar_responsavel}
                onCheckedChange={(checked) => setFormData({ ...formData, notificar_responsavel: checked })}
                disabled={('Notification' in window && Notification.permission === 'denied')}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              size="sm"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} size="sm">
              {loading ? "Agendando..." : "Agendar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

