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
import { MainLayout } from "./components/layout/MainLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/" element={<Navigate to="/analytics" replace />} />
          <Route path="/auth" element={<Auth />} />
          <Route element={<MainLayout />}>
            {/* Nova rota principal Analytics */}
            <Route path="/analytics" element={<Analytics />} />

            {/* Rotas antigas redirecionadas para manter compatibilidade */}
            <Route path="/dashboard" element={<Navigate to="/analytics" replace />} />

            <Route path="/leads" element={<Leads />} />
            <Route path="/kanban" element={<Kanban />} />
            <Route path="/conversas" element={<Conversas />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/tarefas" element={<Tarefas />} />
            <Route path="/ia" element={<IA />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
