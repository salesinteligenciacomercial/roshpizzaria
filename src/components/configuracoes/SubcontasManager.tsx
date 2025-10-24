import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Building2, Users, Edit, Power, Trash2, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { NovaSubcontaDialog } from "./NovaSubcontaDialog";
import { EditarSubcontaDialog } from "./EditarSubcontaDialog";
import { UsuariosSubcontaDialog } from "./UsuariosSubcontaDialog";

interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  plan: string;
  status: string;
  max_users: number;
  max_leads: number;
  settings: any;
  created_at: string;
}

export function SubcontasManager() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNovaDialog, setShowNovaDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [managingUsers, setManagingUsers] = useState<Company | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      console.log("🏢 [SUBCONTAS] Carregando empresas...");
      
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ [SUBCONTAS] Erro ao carregar:", error);
        throw error;
      }
      
      console.log("✅ [SUBCONTAS] Empresas carregadas:", data?.length || 0);
      console.log("📊 [SUBCONTAS] Dados:", data);
      
      setCompanies(data || []);
    } catch (error: any) {
      console.error("❌ [SUBCONTAS] Erro completo:", error);
      toast({
        title: "Erro ao carregar subcontas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (company: Company) => {
    try {
      const newStatus = company.status === "active" ? "inactive" : "active";
      const { error } = await supabase
        .from("companies")
        .update({ status: newStatus })
        .eq("id", company.id);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Empresa ${newStatus === "active" ? "ativada" : "desativada"} com sucesso.`,
      });

      loadCompanies();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (companyId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta subconta? Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("companies")
        .delete()
        .eq("id", companyId);

      if (error) throw error;

      toast({
        title: "Subconta excluída",
        description: "A subconta foi excluída com sucesso.",
      });

      loadCompanies();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir subconta",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getPlanBadge = (plan: string) => {
    const variants: Record<string, any> = {
      free: "secondary",
      basic: "default",
      premium: "default",
    };

    return (
      <Badge variant={variants[plan] || "default"}>
        {plan.toUpperCase()}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge variant={status === "active" ? "default" : "secondary"}>
        {status === "active" ? "Ativo" : "Inativo"}
      </Badge>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Gestão de Subcontas
              </CardTitle>
              <CardDescription>
                Gerencie as empresas licenciadas do sistema
              </CardDescription>
            </div>
            <Button onClick={() => setShowNovaDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Subconta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma subconta cadastrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Criação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>{company.cnpj || "-"}</TableCell>
                    <TableCell>{company.settings?.responsavel || "-"}</TableCell>
                    <TableCell>{getPlanBadge(company.plan)}</TableCell>
                    <TableCell>{getStatusBadge(company.status)}</TableCell>
                    <TableCell>
                      {new Date(company.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setManagingUsers(company)}
                          title="Gerenciar usuários"
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingCompany(company)}
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleStatus(company)}
                          title={company.status === "active" ? "Desativar" : "Ativar"}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(company.id)}
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NovaSubcontaDialog
        open={showNovaDialog}
        onOpenChange={setShowNovaDialog}
        onSuccess={loadCompanies}
      />

      {editingCompany && (
        <EditarSubcontaDialog
          company={editingCompany}
          open={!!editingCompany}
          onOpenChange={(open) => !open && setEditingCompany(null)}
          onSuccess={loadCompanies}
        />
      )}

      {managingUsers && (
        <UsuariosSubcontaDialog
          company={managingUsers}
          open={!!managingUsers}
          onOpenChange={(open) => !open && setManagingUsers(null)}
        />
      )}
    </>
  );
}
