import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Users, MessageSquare, Share2, Globe, Link2, Mail, Phone, Loader2, Megaphone, MousePointerClick, Target, Instagram } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LeadSource {
  source: string | null;
  lead_source_type: string | null;
  utm_source: string | null;
  count: number;
}

interface LeadsBySourceSectionProps {
  companyId: string | null;
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare className="h-4 w-4 text-green-500" />,
  indicacao: <Share2 className="h-4 w-4 text-blue-500" />,
  organic: <Globe className="h-4 w-4 text-muted-foreground" />,
  website: <Link2 className="h-4 w-4 text-purple-500" />,
  email: <Mail className="h-4 w-4 text-orange-500" />,
  telefone: <Phone className="h-4 w-4 text-cyan-500" />,
  facebook: <Megaphone className="h-4 w-4 text-blue-600" />,
  instagram: <Instagram className="h-4 w-4 text-pink-500" />,
  lead_ads: <Target className="h-4 w-4 text-blue-500" />,
  pixel: <MousePointerClick className="h-4 w-4 text-purple-600" />,
  click_to_whatsapp: <MessageSquare className="h-4 w-4 text-green-600" />,
  meta_ads: <Megaphone className="h-4 w-4 text-blue-500" />,
  google: <Globe className="h-4 w-4 text-red-500" />,
  default: <Users className="h-4 w-4 text-muted-foreground" />
};

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  indicacao: 'Indicação',
  organic: 'Orgânico',
  website: 'Website',
  site: 'Site',
  email: 'E-mail',
  telefone: 'Telefone',
  facebook: 'Facebook',
  instagram: 'Instagram',
  google: 'Google Ads',
  lead_ads: 'Lead Ads',
  pixel: 'Pixel do Site',
  click_to_whatsapp: 'Click-to-WhatsApp',
  meta_ads: 'Meta Ads',
  default: 'Outros'
};

const PAID_SOURCES = ['lead_ads', 'pixel', 'click_to_whatsapp', 'meta_ads', 'facebook', 'google'];

export default function LeadsBySourceSection({ companyId }: LeadsBySourceSectionProps) {
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalLeads, setTotalLeads] = useState(0);

  useEffect(() => {
    if (!companyId) return;

    const fetchLeadSources = async () => {
      setLoading(true);
      try {
        // Query leads grouped by source and lead_source_type
        const { data, error } = await supabase
          .from('leads')
          .select('source, lead_source_type, utm_source')
          .eq('company_id', companyId);

        if (error) {
          console.error('[LeadsBySourceSection] Error fetching leads:', error);
          return;
        }

        // Aggregate the data
        const sourceMap = new Map<string, number>();
        
        data?.forEach(lead => {
          // Priority: utm_source > source > lead_source_type > 'organic'
          const sourceKey = (lead.utm_source || lead.source || lead.lead_source_type || 'organic').toLowerCase();
          sourceMap.set(sourceKey, (sourceMap.get(sourceKey) || 0) + 1);
        });

        // Convert to array and sort by count
        const sources: LeadSource[] = Array.from(sourceMap.entries())
          .map(([source, count]) => ({
            source,
            lead_source_type: null,
            utm_source: null,
            count
          }))
          .sort((a, b) => b.count - a.count);

        setLeadSources(sources);
        setTotalLeads(data?.length || 0);
      } catch (err) {
        console.error('[LeadsBySourceSection] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeadSources();
  }, [companyId]);

  const getIcon = (source: string | null) => {
    const key = (source || 'default').toLowerCase();
    return SOURCE_ICONS[key] || SOURCE_ICONS.default;
  };

  const getLabel = (source: string | null) => {
    const key = (source || 'default').toLowerCase();
    return SOURCE_LABELS[key] || source || 'Outros';
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            Leads por Origem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (leadSources.length === 0) {
    return (
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            Leads por Origem
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">
            Nenhum lead cadastrado ainda
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" />
          Leads por Origem
          <span className="text-sm font-normal text-muted-foreground ml-auto">
            Total: {totalLeads.toLocaleString('pt-BR')} leads
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {leadSources.slice(0, 10).map((source, index) => {
            const percentage = totalLeads > 0 ? (source.count / totalLeads) * 100 : 0;
            const sourceKey = (source.source || 'default').toLowerCase();
            const isPaid = PAID_SOURCES.includes(sourceKey);
            
            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getIcon(source.source)}
                    <span className="text-sm font-medium">{getLabel(source.source)}</span>
                    {isPaid && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        Pago
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">{source.count.toLocaleString('pt-BR')}</span>
                    <span className="text-muted-foreground">({percentage.toFixed(1)}%)</span>
                  </div>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            );
          })}
          
          {leadSources.length > 10 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              +{leadSources.length - 10} outras origens
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
