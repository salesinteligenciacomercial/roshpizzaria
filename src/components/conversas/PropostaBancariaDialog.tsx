import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Building2 } from "lucide-react";

interface PropostaBancariaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  companyId: string;
  onPropostaAdded?: () => void;
  editProposta?: {
    id: string;
    banco: string;
    tipo: string;
    valor_liberado: number;
    status: string;
    motivo_cancelamento?: string | null;
    notas?: string | null;
  } | null;
}

const TIPOS_OPERACAO = [
  { value: "novo", label: "Novo" },
  { value: "refinanciamento", label: "Refinanciamento" },
  { value: "portabilidade_pura", label: "Portabilidade Pura" },
  { value: "portabilidade_refin", label: "Portabilidade + Refin" },
];

const STATUS_PROPOSTA = [
  { value: "em_andamento", label: "Em andamento" },
  { value: "aguardando_cip", label: "Aguardando CIP" },
  { value: "aguardando_averbacao", label: "Aguardando Averbação" },
  { value: "aguardando_pagamento", label: "Aguardando Pagamento" },
  { value: "pendente", label: "Pendente" },
  { value: "cancelado", label: "Cancelado" },
  { value: "pago", label: "Pago" },
];

export function PropostaBancariaDialog({
  open,
  onOpenChange,
  leadId,
  companyId,
  onPropostaAdded,
  editProposta,
}: PropostaBancariaDialogProps) {
  const [bancos, setBancos] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [novoBanco, setNovoBanco] = useState("");
  const [showNovoBancoInput, setShowNovoBancoInput] = useState(false);
  const [addingBanco, setAddingBanco] = useState(false);

  // Formulário
  const [banco, setBanco] = useState("");
  const [tipo, setTipo] = useState("novo");
  const [valorLiberado, setValorLiberado] = useState("");
  const [status, setStatus] = useState("em_andamento");
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [notas, setNotas] = useState("");

  // Carregar bancos disponíveis
  const carregarBancos = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("bancos_disponiveis")
        .select("id, nome")
        .eq("company_id", companyId)
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      setBancos(data || []);
    } catch (error) {
      console.error("Erro ao carregar bancos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      carregarBancos();
      
      // Preencher com dados de edição
      if (editProposta) {
        setBanco(editProposta.banco);
        setTipo(editProposta.tipo);
        setValorLiberado(formatarValorInput(editProposta.valor_liberado * 100)); // Converter para centavos
        setStatus(editProposta.status);
        setMotivoCancelamento(editProposta.motivo_cancelamento || "");
        setNotas(editProposta.notas || "");
      } else {
        // Limpar form para nova proposta
        setBanco("");
        setTipo("novo");
        setValorLiberado("");
        setStatus("em_andamento");
        setMotivoCancelamento("");
        setNotas("");
      }
    }
  }, [open, companyId, editProposta]);

  // Formatar valor como moeda brasileira
  const formatarValorInput = (centavos: number) => {
    const reais = centavos / 100;
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(reais);
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (raw === "") {
      setValorLiberado("");
      return;
    }
    const centavos = parseInt(raw, 10);
    setValorLiberado(formatarValorInput(centavos));
  };

  const getValorEmReais = (): number => {
    if (!valorLiberado) return 0;
    const raw = valorLiberado.replace(/\D/g, "");
    return parseInt(raw, 10) / 100;
  };

  const handleAddNovoBanco = async () => {
    if (!novoBanco.trim() || !companyId) return;
    setAddingBanco(true);
    try {
      const { data, error } = await supabase
        .from("bancos_disponiveis")
        .insert({
          company_id: companyId,
          nome: novoBanco.trim(),
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;
      setBancos((prev) => [...prev, { id: data.id, nome: data.nome }].sort((a, b) => a.nome.localeCompare(b.nome)));
      setBanco(data.nome);
      setNovoBanco("");
      setShowNovoBancoInput(false);
      toast.success("Banco cadastrado com sucesso!");
    } catch (error) {
      console.error("Erro ao adicionar banco:", error);
      toast.error("Erro ao cadastrar banco");
    } finally {
      setAddingBanco(false);
    }
  };

  const handleSave = async () => {
    if (!banco.trim()) {
      toast.error("Selecione um banco");
      return;
    }
    if (!tipo) {
      toast.error("Selecione o tipo de operação");
      return;
    }
    if (getValorEmReais() <= 0) {
      toast.error("Informe o valor liberado");
      return;
    }
    if (status === "cancelado" && !motivoCancelamento.trim()) {
      toast.error("Informe o motivo do cancelamento");
      return;
    }

    setSaving(true);
    try {
      const propostaData = {
        company_id: companyId,
        lead_id: leadId,
        banco: banco.trim(),
        tipo,
        valor_liberado: getValorEmReais(),
        status,
        motivo_cancelamento: status === "cancelado" ? motivoCancelamento.trim() : null,
        notas: notas.trim() || null,
      };

      if (editProposta) {
        // Atualizar proposta existente
        const { error } = await supabase
          .from("propostas_bancarias")
          .update(propostaData)
          .eq("id", editProposta.id);

        if (error) throw error;
        toast.success("Proposta atualizada com sucesso!");
      } else {
        // Criar nova proposta
        const { error } = await supabase
          .from("propostas_bancarias")
          .insert(propostaData);

        if (error) throw error;
        toast.success("Proposta cadastrada com sucesso!");
      }

      onPropostaAdded?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao salvar proposta:", error);
      toast.error("Erro ao salvar proposta");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {editProposta ? "Editar Proposta" : "Nova Proposta Bancária"}
          </DialogTitle>
          <DialogDescription>
            {editProposta
              ? "Atualize as informações da proposta"
              : "Adicione uma proposta bancária para este lead"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Banco */}
          <div className="space-y-2">
            <Label>Banco *</Label>
            {showNovoBancoInput ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do banco"
                  value={novoBanco}
                  onChange={(e) => setNovoBanco(e.target.value)}
                  disabled={addingBanco}
                />
                <Button
                  size="sm"
                  onClick={handleAddNovoBanco}
                  disabled={addingBanco || !novoBanco.trim()}
                >
                  {addingBanco ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowNovoBancoInput(false)}
                  disabled={addingBanco}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <Select value={banco} onValueChange={setBanco}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o banco" />
                </SelectTrigger>
                <SelectContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    <>
                      {bancos.map((b) => (
                        <SelectItem key={b.id} value={b.nome}>
                          {b.nome}
                        </SelectItem>
                      ))}
                      <SelectItem value="__novo__" className="text-primary">
                        <div className="flex items-center gap-2">
                          <Plus className="h-3 w-3" />
                          Cadastrar Novo Banco
                        </div>
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            )}
            {banco === "__novo__" && !showNovoBancoInput && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setBanco("");
                  setShowNovoBancoInput(true);
                }}
                className="w-full mt-1"
              >
                <Plus className="h-3 w-3 mr-2" />
                Cadastrar novo banco
              </Button>
            )}
          </div>

          {/* Tipo de Operação */}
          <div className="space-y-2">
            <Label>Tipo de Operação *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_OPERACAO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Valor Liberado */}
          <div className="space-y-2">
            <Label>Valor Liberado *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                R$
              </span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={valorLiberado}
                onChange={handleValorChange}
                className="pl-9"
              />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status *</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_PROPOSTA.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Motivo do Cancelamento (só aparece se status = cancelado) */}
          {status === "cancelado" && (
            <div className="space-y-2">
              <Label>Motivo do Cancelamento *</Label>
              <Textarea
                placeholder="Descreva o motivo do cancelamento..."
                value={motivoCancelamento}
                onChange={(e) => setMotivoCancelamento(e.target.value)}
                rows={2}
              />
            </div>
          )}

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações adicionais..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : editProposta ? (
              "Atualizar"
            ) : (
              "Salvar Proposta"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
