import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

interface NovaConversaDialogProps {
  onNovaConversa: (nome: string, numero: string) => void;
}

export function NovaConversaDialog({ onNovaConversa }: NovaConversaDialogProps) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [numeroSemCodigo, setNumeroSemCodigo] = useState("");

  const handleSalvar = () => {
    if (!nome.trim()) {
      toast.error("Digite o nome do contato");
      return;
    }

    // Remove tudo que não é número
    const numeroLimpo = numeroSemCodigo.replace(/\D/g, '');
    
    if (numeroLimpo.length < 10 || numeroLimpo.length > 11) {
      toast.error("Digite um número válido (DDD + número)");
      return;
    }

    // Adiciona +55 automaticamente
    const numeroCompleto = `55${numeroLimpo}`;
    
    onNovaConversa(nome, numeroCompleto);
    
    // Limpar e fechar
    setNome("");
    setNumeroSemCodigo("");
    setOpen(false);
  };

  const handleNumeroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value.replace(/\D/g, '');
    
    // Limitar a 11 dígitos (DDD + 9 dígitos)
    if (valor.length <= 11) {
      setNumeroSemCodigo(valor);
    }
  };

  const formatarNumeroDisplay = (num: string) => {
    // Remove tudo que não é número
    const numeros = num.replace(/\D/g, '');
    
    // Formata conforme o tamanho
    if (numeros.length <= 2) {
      return numeros; // DDD
    } else if (numeros.length <= 7) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`; // (DDD) XXXXX
    } else if (numeros.length <= 11) {
      return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`; // (DDD) XXXXX-XXXX
    }
    return num;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Nova conversa">
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Salvar Novo Contato</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Contato</Label>
            <Input
              id="nome"
              placeholder="Ex: João Silva"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSalvar()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="numero">Número do WhatsApp</Label>
            <div className="flex gap-2">
              <div className="flex items-center px-3 rounded-md border border-input bg-muted text-sm">
                +55
              </div>
              <Input
                id="numero"
                placeholder="87991426333"
                value={formatarNumeroDisplay(numeroSemCodigo)}
                onChange={handleNumeroChange}
                onKeyDown={(e) => e.key === 'Enter' && handleSalvar()}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Digite o DDD + número (ex: 87991426333)
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar}>
            Salvar Contato
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
