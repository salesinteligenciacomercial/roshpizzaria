import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Download, FileText, UserPlus } from "lucide-react";
import { ProspeccaoKPIs } from "@/components/prospeccao/ProspeccaoKPIs";
import { ProspeccaoTable } from "@/components/prospeccao/ProspeccaoTable";
import { ProspeccaoCharts } from "@/components/prospeccao/ProspeccaoCharts";
import { ProspeccaoFormDialog } from "@/components/prospeccao/ProspeccaoFormDialog";
import { FollowUpTable } from "@/components/prospeccao/FollowUpTable";
import { FollowUpKPIs } from "@/components/prospeccao/FollowUpKPIs";
import { FollowUpFormDialog } from "@/components/prospeccao/FollowUpFormDialog";
import { BenchmarkPanel } from "@/components/prospeccao/BenchmarkPanel";
import { InteractionLogDialog } from "@/components/prospeccao/InteractionLogDialog";
import { InteractionTimeline } from "@/components/prospeccao/InteractionTimeline";
import { ScriptLibrary } from "@/components/prospeccao/ScriptLibrary";
import { useProspeccaoData } from "@/hooks/useProspeccaoData";
import { useFollowUpData } from "@/hooks/useFollowUpData";
import { useInteractions } from "@/hooks/useInteractions";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Prospeccao() {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<"organic" | "paid" | "followup">("organic");
  const [subTab, setSubTab] = useState<"registros" | "interacoes">("registros");
  const [period, setPeriod] = useState("30");
  const [showForm, setShowForm] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [showScripts, setShowScripts] = useState(false);

  const channelType = activeTab === "followup" ? "organic" : activeTab;
  const { data, isLoading, refetch } = useProspeccaoData(channelType as "organic" | "paid", parseInt(period));
  const { data: followUpData, isLoading: followUpLoading, refetch: followUpRefetch } = useFollowUpData(parseInt(period));

  const interactionLogType = activeTab === "followup" ? "followup" : "prospecting";
  const { data: interactions, isLoading: interactionsLoading, refetch: interactionsRefetch } = useInteractions(
    interactionLogType as "prospecting" | "followup",
    parseInt(period)
  );

  const handleExportCSV = () => {
    if (activeTab === "followup") {
      if (!followUpData || followUpData.length === 0) return;
      const headers = "Data,Responsável,Canal,Follow-ups,Respostas,%Resp,Reuniões,%Reun,Vendas,Ticket,Bruto";
      const rows = followUpData.map(r => {
        const ticket = r.sales_closed > 0 ? (r.gross_value / r.sales_closed).toFixed(2) : "0";
        const pResp = r.followups_sent > 0 ? ((r.responses / r.followups_sent) * 100).toFixed(1) : "0";
        const pReun = r.responses > 0 ? ((r.meetings_scheduled / r.responses) * 100).toFixed(1) : "0";
        return `${r.log_date},${r.user_name || ""},${r.source || ""},${r.followups_sent},${r.responses},${pResp}%,${r.meetings_scheduled},${pReun}%,${r.sales_closed},${ticket},${r.gross_value}`;
      });
      const csv = [headers, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `followup_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (!data || data.length === 0) return;
    const isPaid = activeTab === "paid";
    const headers = isPaid
      ? "Data,Responsável,Fonte,Gasto,Leads,CPL,Oportunidades,CPO,Reuniões,Vendas,CPV,Ticket Médio,Bruto,ROI"
      : "Data,Responsável,Fonte,Leads,Oportunidades,Reuniões,Vendas,Ticket Médio,Bruto";
    const rows = data.map(r => {
      const ticket = r.sales_closed > 0 ? (r.gross_value / r.sales_closed).toFixed(2) : "0";
      if (!isPaid) return `${r.log_date},${r.user_name || ""},${r.source || ""},${r.leads_prospected},${r.opportunities},${r.meetings_scheduled},${r.sales_closed},${ticket},${r.gross_value}`;
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
    a.download = `prospeccao_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRegister = () => {
    if (activeTab === "followup") {
      setShowFollowUpForm(true);
    } else {
      setShowForm(true);
    }
  };

  const handleRefreshAll = () => {
    if (activeTab === "followup") {
      followUpRefetch();
    } else {
      refetch();
    }
    interactionsRefetch();
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Acompanhamento de Prospecção</h1>
          <p className="text-sm text-muted-foreground">Acompanhe o funil de prospecção, tráfego pago e follow-up</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          <Button variant="outline" size="sm" onClick={() => setShowScripts(true)}>
            <FileText className="h-4 w-4 mr-1" /> Scripts
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowInteractionForm(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Interação
          </Button>
          <Button size="sm" onClick={handleRegister}>
            <Plus className="h-4 w-4 mr-1" /> Registrar
          </Button>
        </div>
      </div>

      <div className={`flex gap-6 ${isMobile ? "flex-col" : ""}`}>
        <div className="flex-1 min-w-0">
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); setSubTab("registros"); }}>
            <TabsList>
              <TabsTrigger value="organic">Orgânico</TabsTrigger>
              <TabsTrigger value="paid">Tráfego Pago</TabsTrigger>
              <TabsTrigger value="followup">Follow-Up</TabsTrigger>
            </TabsList>

            {/* Sub-tab toggle */}
            <div className="flex gap-1 mt-3 mb-4">
              <Button
                variant={subTab === "registros" ? "default" : "ghost"}
                size="sm"
                onClick={() => setSubTab("registros")}
              >
                Registros
              </Button>
              <Button
                variant={subTab === "interacoes" ? "default" : "ghost"}
                size="sm"
                onClick={() => setSubTab("interacoes")}
              >
                Interações ({interactions?.length || 0})
              </Button>
            </div>

            {subTab === "interacoes" ? (
              <div className="space-y-6">
                <InteractionTimeline
                  data={interactions || []}
                  isLoading={interactionsLoading}
                  onRefresh={interactionsRefetch}
                />
              </div>
            ) : (
              <>
                <TabsContent value="organic" className="space-y-6 mt-0">
                  <ProspeccaoKPIs data={data || []} channelType="organic" isLoading={isLoading} />
                  <ProspeccaoCharts data={data || []} channelType="organic" />
                  <ProspeccaoTable data={data || []} channelType="organic" isLoading={isLoading} onRefresh={refetch} />
                </TabsContent>

                <TabsContent value="paid" className="space-y-6 mt-0">
                  <ProspeccaoKPIs data={data || []} channelType="paid" isLoading={isLoading} />
                  <ProspeccaoCharts data={data || []} channelType="paid" />
                  <ProspeccaoTable data={data || []} channelType="paid" isLoading={isLoading} onRefresh={refetch} />
                </TabsContent>

                <TabsContent value="followup" className="space-y-6 mt-0">
                  <FollowUpKPIs data={followUpData || []} isLoading={followUpLoading} />
                  <FollowUpTable data={followUpData || []} isLoading={followUpLoading} onRefresh={followUpRefetch} />
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>

        <div className={`${isMobile ? "w-full" : "w-64 shrink-0"}`}>
          <BenchmarkPanel />
        </div>
      </div>

      <ProspeccaoFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        channelType={activeTab === "followup" ? "organic" : activeTab}
        onSuccess={refetch}
      />

      <FollowUpFormDialog
        open={showFollowUpForm}
        onOpenChange={setShowFollowUpForm}
        onSuccess={followUpRefetch}
      />

      <InteractionLogDialog
        open={showInteractionForm}
        onOpenChange={setShowInteractionForm}
        logType={interactionLogType as "prospecting" | "followup"}
        onSuccess={handleRefreshAll}
      />

      <ScriptLibrary
        open={showScripts}
        onOpenChange={setShowScripts}
      />
    </div>
  );
}
