import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Download } from "lucide-react";
import { ProspeccaoKPIs } from "@/components/prospeccao/ProspeccaoKPIs";
import { ProspeccaoTable } from "@/components/prospeccao/ProspeccaoTable";
import { ProspeccaoCharts } from "@/components/prospeccao/ProspeccaoCharts";
import { ProspeccaoFormDialog } from "@/components/prospeccao/ProspeccaoFormDialog";
import { useProspeccaoData } from "@/hooks/useProspeccaoData";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Prospeccao() {
  const isMobile = useIsMobile();
  const [channelType, setChannelType] = useState<"organic" | "paid">("organic");
  const [period, setPeriod] = useState("30");
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, refetch } = useProspeccaoData(channelType, parseInt(period));

  const handleExportCSV = () => {
    if (!data || data.length === 0) return;
    const headers = channelType === "organic"
      ? "Data,Responsável,Fonte,Leads,Oportunidades,Reuniões,Vendas,Ticket Médio,Bruto"
      : "Data,Responsável,Fonte,Gasto,Leads,CPL,Oportunidades,CPO,Reuniões,Vendas,CPV,Ticket Médio,Bruto,ROI";
    
    const rows = data.map(r => {
      const ticket = r.sales_closed > 0 ? (r.gross_value / r.sales_closed).toFixed(2) : "0";
      if (channelType === "organic") {
        return `${r.log_date},${r.user_name || ""},${r.source || ""},${r.leads_prospected},${r.opportunities},${r.meetings_scheduled},${r.sales_closed},${ticket},${r.gross_value}`;
      }
      const cpl = r.leads_prospected > 0 ? (r.ad_spend / r.leads_prospected).toFixed(2) : "0";
      const cpo = r.opportunities > 0 ? (r.ad_spend / r.opportunities).toFixed(2) : "0";
      const cpv = r.sales_closed > 0 ? (r.ad_spend / r.sales_closed).toFixed(2) : "0";
      const roi = r.ad_spend > 0 ? (((r.gross_value - r.ad_spend) / r.ad_spend) * 100).toFixed(1) : "0";
      return `${r.log_date},${r.user_name || ""},${r.source || ""},${r.ad_spend},${r.leads_prospected},${cpl},${r.opportunities},${cpo},${r.meetings_scheduled},${r.sales_closed},${cpv},${ticket},${r.gross_value},${roi}%`;
    });
    
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prospeccao_${channelType}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Acompanhamento de Prospecção</h1>
          <p className="text-sm text-muted-foreground">Acompanhe o funil de prospecção orgânica e tráfego pago</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="15">15 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="60">60 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Registrar
          </Button>
        </div>
      </div>

      <Tabs value={channelType} onValueChange={(v) => setChannelType(v as "organic" | "paid")}>
        <TabsList>
          <TabsTrigger value="organic">Prospecção Orgânica</TabsTrigger>
          <TabsTrigger value="paid">Tráfego Pago</TabsTrigger>
        </TabsList>

        <TabsContent value="organic" className="space-y-6 mt-4">
          <ProspeccaoKPIs data={data || []} channelType="organic" isLoading={isLoading} />
          <ProspeccaoCharts data={data || []} channelType="organic" />
          <ProspeccaoTable data={data || []} channelType="organic" isLoading={isLoading} onRefresh={refetch} />
        </TabsContent>

        <TabsContent value="paid" className="space-y-6 mt-4">
          <ProspeccaoKPIs data={data || []} channelType="paid" isLoading={isLoading} />
          <ProspeccaoCharts data={data || []} channelType="paid" />
          <ProspeccaoTable data={data || []} channelType="paid" isLoading={isLoading} onRefresh={refetch} />
        </TabsContent>
      </Tabs>

      <ProspeccaoFormDialog 
        open={showForm} 
        onOpenChange={setShowForm} 
        channelType={channelType}
        onSuccess={refetch} 
      />
    </div>
  );
}
