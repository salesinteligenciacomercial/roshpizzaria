import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Target, 
  ExternalLink, 
  CheckCircle2, 
  ArrowRight,
  Megaphone,
  Users,
  LineChart,
  FileText
} from "lucide-react";

interface CampaignEmptyStateProps {
  accountName: string;
}

export default function CampaignEmptyState({ accountName }: CampaignEmptyStateProps) {
  const steps = [
    {
      number: 1,
      title: "Acesse o Meta Ads Manager",
      description: "Entre no Gerenciador de Anúncios da Meta",
      icon: <ExternalLink className="h-4 w-4" />
    },
    {
      number: 2,
      title: "Crie uma campanha de Leads",
      description: "Escolha o objetivo 'Geração de Cadastros' ou 'Mensagens'",
      icon: <Target className="h-4 w-4" />
    },
    {
      number: 3,
      title: "Configure o formulário Lead Ads",
      description: "Crie um formulário para capturar dados dos leads",
      icon: <FileText className="h-4 w-4" />
    },
    {
      number: 4,
      title: "Leads aparecem automaticamente",
      description: "Os dados serão sincronizados com o CRM",
      icon: <CheckCircle2 className="h-4 w-4" />
    }
  ];

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4 text-primary" />
            Campanhas Meta Ads
          </CardTitle>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">
              Conta conectada: <strong className="text-foreground">{accountName}</strong>
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Alert Banner */}
        <div className="bg-accent/50 border border-accent rounded-lg p-4">
          <div className="flex items-start gap-3">
            <LineChart className="h-5 w-5 text-accent-foreground mt-0.5" />
            <div>
              <h4 className="font-medium text-accent-foreground">
                Nenhuma campanha encontrada
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                Sua conta está conectada, mas não existem campanhas criadas no período selecionado.
                Siga o guia abaixo para começar a anunciar.
              </p>
            </div>
          </div>
        </div>

        {/* Setup Guide */}
        <div className="bg-muted/50 rounded-lg p-6">
          <h4 className="font-semibold flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-primary" />
            Como começar a capturar leads via Meta Ads
          </h4>
          
          <div className="grid gap-4 md:grid-cols-2">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-start gap-3 p-3 bg-background rounded-lg">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
                  {step.number}
                </div>
                <div>
                  <p className="font-medium text-sm flex items-center gap-2">
                    {step.title}
                    {step.icon}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                </div>
                {index < steps.length - 1 && index % 2 === 0 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="default"
            className="flex-1"
            onClick={() => window.open('https://adsmanager.facebook.com', '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir Meta Ads Manager
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => window.open('https://www.facebook.com/business/help/1462876307360828', '_blank')}
          >
            <FileText className="h-4 w-4 mr-2" />
            Documentação Lead Ads
          </Button>
        </div>

        {/* Additional Info */}
        <div className="grid gap-4 md:grid-cols-3 pt-4 border-t">
          <div className="text-center p-4">
            <Megaphone className="h-8 w-8 text-primary mx-auto mb-2" />
            <h5 className="font-medium text-sm">Campanhas</h5>
            <p className="text-xs text-muted-foreground">
              Crie campanhas com objetivo de leads ou mensagens
            </p>
          </div>
          <div className="text-center p-4">
            <Users className="h-8 w-8 text-primary mx-auto mb-2" />
            <h5 className="font-medium text-sm">Lead Ads</h5>
            <p className="text-xs text-muted-foreground">
              Formulários nativos que capturam dados automaticamente
            </p>
          </div>
          <div className="text-center p-4">
            <LineChart className="h-8 w-8 text-primary mx-auto mb-2" />
            <h5 className="font-medium text-sm">Analytics</h5>
            <p className="text-xs text-muted-foreground">
              Acompanhe métricas de gasto, CTR, CPL em tempo real
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
