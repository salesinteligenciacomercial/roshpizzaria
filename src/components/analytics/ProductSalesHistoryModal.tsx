import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { 
  History, Download, Search, Calendar, User, DollarSign, 
  Loader2, ArrowUpDown, ChevronUp, ChevronDown 
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Sale {
  id: string;
  leadName: string;
  leadPhone: string;
  value: number;
  wonAt: string;
  responsavelName: string;
}

interface ProductSalesHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  companyId: string;
}

export default function ProductSalesHistoryModal({
  open,
  onOpenChange,
  productId,
  productName,
  companyId
}: ProductSalesHistoryModalProps) {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<"wonAt" | "value">("wonAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (open && productId) {
      fetchSales();
    }
  }, [open, productId]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const { data: leads, error } = await supabase
        .from("leads")
        .select(`
          id,
          name,
          phone,
          telefone,
          value,
          won_at,
          responsavel_id
        `)
        .eq("company_id", companyId)
        .eq("produto_id", productId)
        .eq("status", "ganho")
        .order("won_at", { ascending: false });

      if (error) throw error;

      // Get responsavel names
      const responsavelIds = [...new Set((leads || []).map(l => l.responsavel_id).filter(Boolean))];
      let responsaveisMap: Record<string, string> = {};

      if (responsavelIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", responsavelIds);

        responsaveisMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p.full_name || "Sem nome";
          return acc;
        }, {} as Record<string, string>);
      }

      const formattedSales: Sale[] = (leads || []).map(lead => ({
        id: lead.id,
        leadName: lead.name || "Sem nome",
        leadPhone: lead.phone || lead.telefone || "",
        value: Number(lead.value) || 0,
        wonAt: lead.won_at || "",
        responsavelName: lead.responsavel_id ? (responsaveisMap[lead.responsavel_id] || "N/A") : "N/A"
      }));

      setSales(formattedSales);
    } catch (error) {
      console.error("[ProductSalesHistory] Error:", error);
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
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return "N/A";
    }
  };

  const handleSort = (field: "wonAt" | "value") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const filteredAndSortedSales = sales
    .filter(sale => 
      sale.leadName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.leadPhone.includes(searchTerm) ||
      sale.responsavelName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortField === "wonAt") {
        const dateA = new Date(a.wonAt).getTime();
        const dateB = new Date(b.wonAt).getTime();
        return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
      } else {
        return sortDirection === "asc" ? a.value - b.value : b.value - a.value;
      }
    });

  const totalValue = filteredAndSortedSales.reduce((sum, s) => sum + s.value, 0);

  const exportToCSV = () => {
    const headers = ["Cliente", "Telefone", "Valor", "Data da Venda", "Responsável"];
    const rows = filteredAndSortedSales.map(s => [
      s.leadName,
      s.leadPhone,
      s.value.toString(),
      formatDate(s.wonAt),
      s.responsavelName
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `vendas_${productName.replace(/\s+/g, "_")}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const SortIcon = ({ field }: { field: "wonAt" | "value" }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return sortDirection === "asc" 
      ? <ChevronUp className="h-3 w-3 ml-1" />
      : <ChevronDown className="h-3 w-3 ml-1" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Vendas - {productName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="flex flex-wrap gap-4">
            <Badge variant="secondary" className="text-sm py-1 px-3">
              {filteredAndSortedSales.length} vendas
            </Badge>
            <Badge variant="secondary" className="text-sm py-1 px-3 bg-green-100 text-green-700">
              Total: {formatCurrency(totalValue)}
            </Badge>
          </div>

          {/* Search and Export */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, telefone ou responsável..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={exportToCSV} disabled={sales.length === 0}>
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
            <ScrollArea className="h-[400px] rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-1" />
                        Cliente
                      </div>
                    </TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("value")}
                    >
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-1" />
                        Valor
                        <SortIcon field="value" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("wonAt")}
                    >
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        Data da Venda
                        <SortIcon field="wonAt" />
                      </div>
                    </TableHead>
                    <TableHead>Responsável</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhuma venda encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedSales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium">{sale.leadName}</TableCell>
                        <TableCell>{sale.leadPhone || "-"}</TableCell>
                        <TableCell className="text-green-600 font-medium">
                          {formatCurrency(sale.value)}
                        </TableCell>
                        <TableCell>{formatDate(sale.wonAt)}</TableCell>
                        <TableCell>{sale.responsavelName}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
