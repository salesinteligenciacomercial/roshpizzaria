import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BillingInvoice } from '@/hooks/useFinanceiro';
import { Loader2, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RegistrarPagamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: BillingInvoice;
  onConfirm: (invoiceId: string, paymentMethod?: string) => Promise<boolean>;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function RegistrarPagamentoDialog({
  open,
  onOpenChange,
  invoice,
  onConfirm
}: RegistrarPagamentoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('pix');

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const success = await onConfirm(invoice.id, paymentMethod);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            Registrar Pagamento
          </DialogTitle>
          <DialogDescription>
            Confirme o recebimento do pagamento desta fatura
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fatura:</span>
              <span className="font-mono">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Empresa:</span>
              <span className="font-medium">{invoice.company?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor:</span>
              <span className="font-bold text-emerald-600">{formatCurrency(invoice.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vencimento:</span>
              <span>{format(new Date(invoice.due_date), "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Método de Pagamento</Label>
            <Select
              value={paymentMethod}
              onValueChange={setPaymentMethod}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="manual">Manual/Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
