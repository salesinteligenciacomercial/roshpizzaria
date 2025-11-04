import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Analytics from "./pages/Analytics";
import Dashboard from "./pages/Dashboard"; // Mantido para compatibilidade
import Leads from "./pages/Leads";
import Kanban from "./pages/Kanban";
import Conversas from "./pages/Conversas";
import Agenda from "./pages/Agenda";
import Tarefas from "./pages/Tarefas";
import IA from "./pages/IA";
import Configuracoes from "./pages/Configuracoes";
import Relatorios from "./pages/Relatorios";
import { MainLayout } from "./components/layout/MainLayout";
import NotFound from "./pages/NotFound";
import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from "./components/ui/button";

const queryClient = new QueryClient();

// Error Boundary component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  state = { hasError: false, error: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Erro capturado:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-bold text-destructive">Ocorreu um erro</h1>
            <p className="text-muted-foreground">{this.state.error}</p>
            <p className="text-sm">Verifique o console (F12) para mais detalhes ou recarregue a página.</p>
            <Button onClick={() => window.location.reload()}>Recarregar</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TooltipProvider>
        <ErrorBoundary>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Navigate to="/kanban" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="leads" element={<Leads />} />
              <Route path="kanban" element={<Kanban />} />
              <Route path="tarefas" element={<Tarefas />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="conversas" element={<Conversas />} />
              <Route path="ia" element={<IA />} />
              <Route path="relatorios" element={<Relatorios />} />
              <Route path="configuracoes" element={<Configuracoes />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
