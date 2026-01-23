import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LayoutDashboard, 
  CreditCard, 
  FileText, 
  ArrowLeftRight,
  TrendingUp,
  ShieldAlert
} from 'lucide-react';
import { useFinanceiro } from '@/hooks/useFinanceiro';
import { FinanceiroDashboard } from '@/components/financeiro/FinanceiroDashboard';
import { AssinaturasManager } from '@/components/financeiro/AssinaturasManager';
import { FaturasManager } from '@/components/financeiro/FaturasManager';
import { TransacoesManager } from '@/components/financeiro/TransacoesManager';
import { MRRChart } from '@/components/financeiro/MRRChart';
import { supabase } from '@/integrations/supabase/client';

export default function Financeiro() {
  const [isMasterAccount, setIsMasterAccount] = useState<boolean | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const {
    loading,
    plans,
    subscriptions,
    invoices,
    transactions,
    kpis,
    createSubscription,
    updateSubscription,
    createInvoice,
    updateInvoice,
    markInvoiceAsPaid,
    createTransaction
  } = useFinanceiro();

  // Check if user has access (is master account)
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: company } = await supabase
          .rpc('get_my_company');
        
        if (company && company.length > 0) {
          setIsMasterAccount(company[0].is_master_account === true);
        } else {
          setIsMasterAccount(false);
        }
      } catch (error) {
        console.error('Error checking access:', error);
        setIsMasterAccount(false);
      } finally {
        setCheckingAccess(false);
      }
    };

    checkAccess();
  }, []);

  // Show loading while checking access
  if (checkingAccess) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Redirect if not master account
  if (!isMasterAccount) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
        <p className="text-muted-foreground max-w-md">
          Esta área é exclusiva para contas master. 
          Entre em contato com o administrador se precisar de acesso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-muted-foreground">
          Gerencie assinaturas, faturas e acompanhe o MRR das suas subcontas
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="assinaturas" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Assinaturas</span>
          </TabsTrigger>
          <TabsTrigger value="faturas" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Faturas</span>
          </TabsTrigger>
          <TabsTrigger value="transacoes" className="gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            <span className="hidden sm:inline">Transações</span>
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Relatórios</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <FinanceiroDashboard kpis={kpis} loading={loading} />
          <MRRChart 
            subscriptions={subscriptions} 
            transactions={transactions} 
            loading={loading} 
          />
        </TabsContent>

        <TabsContent value="assinaturas">
          <AssinaturasManager
            subscriptions={subscriptions}
            plans={plans}
            loading={loading}
            onCreateSubscription={createSubscription}
            onUpdateSubscription={updateSubscription}
            onCreateInvoice={createInvoice}
          />
        </TabsContent>

        <TabsContent value="faturas">
          <FaturasManager
            invoices={invoices}
            subscriptions={subscriptions}
            loading={loading}
            onCreateInvoice={createInvoice}
            onUpdateInvoice={updateInvoice}
            onMarkAsPaid={markInvoiceAsPaid}
          />
        </TabsContent>

        <TabsContent value="transacoes">
          <TransacoesManager
            transactions={transactions}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="relatorios" className="space-y-6">
          <MRRChart 
            subscriptions={subscriptions} 
            transactions={transactions} 
            loading={loading} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
