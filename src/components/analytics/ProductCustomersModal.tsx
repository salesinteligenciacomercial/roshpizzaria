import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, Download, Search, Phone, Mail, Calendar, 
  Loader2, MessageSquare, Send
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  purchaseDate: string;
  value: number;
  selected: boolean;
}

interface ProductCustomersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  companyId: string;
}

export default function ProductCustomersModal({
  open,
  onOpenChange,
  productId,
  productName,
  companyId
}: ProductCustomersModalProps) {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    if (open && productId) {
      fetchCustomers();
    }
  }, [open, productId]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data: leads, error } = await supabase
        .from("leads")
        .select(`
          id,
          name,
          phone,
          telefone,
          email,
          value,
          won_at
        `)
        .eq("company_id", companyId)
        .eq("produto_id", productId)
        .eq("status", "ganho")
        .order("won_at", { ascending: false });

      if (error) throw error;

      // Deduplicate by phone or email
      const seen = new Set<string>();
      const uniqueCustomers: Customer[] = [];

      (leads || []).forEach(lead => {
        const key = lead.phone || lead.telefone || lead.email || lead.id;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueCustomers.push({
            id: lead.id,
            name: lead.name || "Sem nome",
            phone: lead.phone || lead.telefone || "",
            email: lead.email || "",
            purchaseDate: lead.won_at || "",
            value: Number(lead.value) || 0,
            selected: false
          });
        }
      });

      setCustomers(uniqueCustomers);
    } catch (error) {
      console.error("[ProductCustomers] Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "N/A";
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    setCustomers(customers.map(c => ({ ...c, selected: checked })));
  };

  const handleSelectCustomer = (id: string, checked: boolean) => {
    setCustomers(customers.map(c => 
      c.id === id ? { ...c, selected: checked } : c
    ));
    if (!checked) setSelectAll(false);
  };

  const selectedCustomers = customers.filter(c => c.selected);
  const selectedWithPhone = selectedCustomers.filter(c => c.phone);

  const handleStartCampaign = () => {
    if (selectedWithPhone.length === 0) {
      toast.error("Selecione clientes com telefone para iniciar uma campanha");
      return;
    }
    
    toast.success(`${selectedWithPhone.length} clientes selecionados para campanha`);
    // Here you would integrate with the mass messaging feature
  };

  const exportToCSV = () => {
    const headers = ["Nome", "Telefone", "Email", "Data da Compra", "Valor"];
    const rows = filteredCustomers.map(c => [
      c.name,
      c.phone,
      c.email,
      formatDate(c.purchaseDate),
      c.value.toString()
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `clientes_${productName.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Clientes - {productName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="flex flex-wrap gap-4">
            <Badge variant="secondary" className="text-sm py-1 px-3">
              {customers.length} clientes únicos
            </Badge>
            {selectedCustomers.length > 0 && (
              <Badge variant="default" className="text-sm py-1 px-3">
                {selectedCustomers.length} selecionados
              </Badge>
            )}
          </div>

          {/* Search and Actions */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={exportToCSV} disabled={customers.length === 0}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <ScrollArea className="h-[350px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={selectAll}
                        onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                      />
                    </TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Phone className="h-4 w-4" />
                        Telefone
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4" />
                        Email
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Compra
                      </div>
                    </TableHead>
                    <TableHead>Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum cliente encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <Checkbox 
                            checked={customer.selected}
                            onCheckedChange={(checked) => handleSelectCustomer(customer.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{customer.phone || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{customer.email || "-"}</TableCell>
                        <TableCell>{formatDate(customer.purchaseDate)}</TableCell>
                        <TableCell className="text-green-600 font-medium">
                          {formatCurrency(customer.value)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="default" 
            onClick={handleStartCampaign}
            disabled={selectedWithPhone.length === 0}
            className="w-full sm:w-auto"
          >
            <Send className="h-4 w-4 mr-1" />
            Iniciar Campanha ({selectedWithPhone.length})
          </Button>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
