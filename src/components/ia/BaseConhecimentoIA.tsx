import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Plus } from "lucide-react";

export function BaseConhecimentoIA() {
  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Base de Conhecimento da IA</CardTitle>
              <p className="text-sm text-muted-foreground">Cadastre conteúdos para melhorar respostas</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder="Título do conteúdo" />
            <Input placeholder="Categoria (ex.: Produtos, Suporte)" />
          </div>
          <Textarea rows={6} placeholder="Cole aqui FAQs, procedimentos, respostas padrão..." />
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar à Base
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle>Conteúdos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground py-6 text-center">
            Nenhum conteúdo cadastrado ainda.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


