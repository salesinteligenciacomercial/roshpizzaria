import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Save, RefreshCw, Target, Bot, Bell, Tag } from 'lucide-react';

interface LeadAdForm {
  id: string;
  page_id: string;
  form_id: string;
  form_name: string | null;
  auto_tags: string[];
  auto_funil_id: string | null;
  auto_etapa_id: string | null;
  auto_responsavel_id: string | null;
  auto_qualify_with_ia: boolean;
  qualification_prompt: string | null;
  notify_whatsapp: boolean;
  notify_phone: string | null;
}

interface Funil {
  id: string;
  nome: string;
}

interface Etapa {
  id: string;
  nome: string;
  funil_id: string;
}

interface Profile {
  id: string;
  full_name: string;
}

export function LeadAdsFormsConfig() {
  const [forms, setForms] = useState<LeadAdForm[]>([]);
  const [funis, setFunis] = useState<Funil[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get company ID
      const { data: userData } = await supabase.rpc('get_my_company_id');
      if (!userData) {
        toast.error('Empresa não encontrada');
        return;
      }
      setCompanyId(userData);

      // Load forms, funis, etapas, profiles in parallel
      const [formsRes, funisRes, etapasRes, profilesRes] = await Promise.all([
        supabase
          .from('lead_ad_forms')
          .select('*')
          .eq('company_id', userData)
          .order('created_at', { ascending: false }),
        supabase
          .from('funis')
          .select('id, nome')
          .eq('company_id', userData),
        supabase
          .from('etapas')
          .select('id, nome, funil_id')
          .eq('company_id', userData),
        supabase
          .from('profiles')
          .select('id, full_name')
      ]);

      if (formsRes.data) setForms(formsRes.data as LeadAdForm[]);
      if (funisRes.data) setFunis(funisRes.data);
      if (etapasRes.data) setEtapas(etapasRes.data);
      if (profilesRes.data) setProfiles(profilesRes.data);

    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const addNewForm = () => {
    if (!companyId) return;

    const newForm: LeadAdForm = {
      id: `temp-${Date.now()}`,
      page_id: '',
      form_id: '',
      form_name: '',
      auto_tags: ['Lead Ads'],
      auto_funil_id: null,
      auto_etapa_id: null,
      auto_responsavel_id: null,
      auto_qualify_with_ia: true,
      qualification_prompt: null,
      notify_whatsapp: false,
      notify_phone: null
    };

    setForms([newForm, ...forms]);
  };

  const updateForm = (id: string, updates: Partial<LeadAdForm>) => {
    setForms(forms.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeForm = async (id: string) => {
    if (id.startsWith('temp-')) {
      setForms(forms.filter(f => f.id !== id));
      return;
    }

    try {
      const { error } = await supabase
        .from('lead_ad_forms')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setForms(forms.filter(f => f.id !== id));
      toast.success('Formulário removido');
    } catch (error) {
      console.error('Error removing form:', error);
      toast.error('Erro ao remover formulário');
    }
  };

  const addTag = (formId: string) => {
    const tag = newTagInput[formId]?.trim();
    if (!tag) return;

    const form = forms.find(f => f.id === formId);
    if (!form) return;

    if (!form.auto_tags.includes(tag)) {
      updateForm(formId, { auto_tags: [...form.auto_tags, tag] });
    }

    setNewTagInput({ ...newTagInput, [formId]: '' });
  };

  const removeTag = (formId: string, tag: string) => {
    const form = forms.find(f => f.id === formId);
    if (!form) return;

    updateForm(formId, { auto_tags: form.auto_tags.filter(t => t !== tag) });
  };

  const saveForm = async (form: LeadAdForm) => {
    if (!companyId) return;

    if (!form.page_id || !form.form_id) {
      toast.error('Page ID e Form ID são obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const formData = {
        company_id: companyId,
        page_id: form.page_id,
        form_id: form.form_id,
        form_name: form.form_name || null,
        auto_tags: form.auto_tags,
        auto_funil_id: form.auto_funil_id || null,
        auto_etapa_id: form.auto_etapa_id || null,
        auto_responsavel_id: form.auto_responsavel_id || null,
        auto_qualify_with_ia: form.auto_qualify_with_ia,
        qualification_prompt: form.qualification_prompt || null,
        notify_whatsapp: form.notify_whatsapp,
        notify_phone: form.notify_phone || null
      };

      if (form.id.startsWith('temp-')) {
        // Create new
        const { data, error } = await supabase
          .from('lead_ad_forms')
          .insert(formData)
          .select()
          .single();

        if (error) throw error;

        setForms(forms.map(f => f.id === form.id ? data as LeadAdForm : f));
        toast.success('Formulário salvo');
      } else {
        // Update existing
        const { error } = await supabase
          .from('lead_ad_forms')
          .update(formData)
          .eq('id', form.id);

        if (error) throw error;

        toast.success('Formulário atualizado');
      }
    } catch (error: any) {
      console.error('Error saving form:', error);
      if (error.code === '23505') {
        toast.error('Já existe um formulário com este Form ID');
      } else {
        toast.error('Erro ao salvar formulário');
      }
    } finally {
      setSaving(false);
    }
  };

  const getEtapasForFunil = (funilId: string | null) => {
    if (!funilId) return [];
    return etapas.filter(e => e.funil_id === funilId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Formulários Lead Ads</h3>
          <p className="text-sm text-muted-foreground">
            Configure como leads de campanhas de tráfego pago serão processados
          </p>
        </div>
        <Button onClick={addNewForm}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Formulário
        </Button>
      </div>

      {forms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Nenhum formulário configurado.<br />
              Adicione formulários de Lead Ads para rastrear leads de campanhas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {forms.map(form => (
            <Card key={form.id} className="relative">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {form.form_name || 'Novo Formulário'}
                      {form.id.startsWith('temp-') && (
                        <Badge variant="outline" className="ml-2">Não salvo</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {form.form_id || 'Configure o Form ID abaixo'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => saveForm(form)}
                      disabled={saving}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Salvar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeForm(form.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* IDs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Page ID *</Label>
                    <Input
                      placeholder="Ex: 123456789"
                      value={form.page_id}
                      onChange={e => updateForm(form.id, { page_id: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Form ID *</Label>
                    <Input
                      placeholder="Ex: 987654321"
                      value={form.form_id}
                      onChange={e => updateForm(form.id, { form_id: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome do Formulário</Label>
                    <Input
                      placeholder="Ex: Formulário Black Friday"
                      value={form.form_name || ''}
                      onChange={e => updateForm(form.id, { form_name: e.target.value })}
                    />
                  </div>
                </div>

                {/* Funil e Etapa */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Funil Padrão</Label>
                    <Select
                      value={form.auto_funil_id || ''}
                      onValueChange={value => updateForm(form.id, { 
                        auto_funil_id: value || null,
                        auto_etapa_id: null 
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um funil" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nenhum</SelectItem>
                        {funis.map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Etapa Inicial</Label>
                    <Select
                      value={form.auto_etapa_id || ''}
                      onValueChange={value => updateForm(form.id, { auto_etapa_id: value || null })}
                      disabled={!form.auto_funil_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma etapa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nenhuma</SelectItem>
                        {getEtapasForFunil(form.auto_funil_id).map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Responsável Padrão</Label>
                    <Select
                      value={form.auto_responsavel_id || ''}
                      onValueChange={value => updateForm(form.id, { auto_responsavel_id: value || null })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nenhum</SelectItem>
                        {profiles.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Tags Automáticas
                  </Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {form.auto_tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(form.id, tag)}>
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nova tag..."
                      value={newTagInput[form.id] || ''}
                      onChange={e => setNewTagInput({ ...newTagInput, [form.id]: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && addTag(form.id)}
                    />
                    <Button variant="outline" onClick={() => addTag(form.id)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* IA Qualification */}
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-primary" />
                      <Label>Qualificação Automática por IA</Label>
                    </div>
                    <Switch
                      checked={form.auto_qualify_with_ia}
                      onCheckedChange={checked => updateForm(form.id, { auto_qualify_with_ia: checked })}
                    />
                  </div>
                  {form.auto_qualify_with_ia && (
                    <div className="space-y-2">
                      <Label>Prompt Personalizado (opcional)</Label>
                      <Textarea
                        placeholder="Deixe vazio para usar o prompt padrão..."
                        value={form.qualification_prompt || ''}
                        onChange={e => updateForm(form.id, { qualification_prompt: e.target.value })}
                        rows={3}
                      />
                    </div>
                  )}
                </div>

                {/* Notifications */}
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-primary" />
                      <Label>Notificar via WhatsApp</Label>
                    </div>
                    <Switch
                      checked={form.notify_whatsapp}
                      onCheckedChange={checked => updateForm(form.id, { notify_whatsapp: checked })}
                    />
                  </div>
                  {form.notify_whatsapp && (
                    <div className="space-y-2">
                      <Label>Telefone para Notificação</Label>
                      <Input
                        placeholder="Ex: 5511999999999"
                        value={form.notify_phone || ''}
                        onChange={e => updateForm(form.id, { notify_phone: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Webhook URL Info */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            URL do Webhook para Lead Ads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Configure esta URL no Meta Developers para receber leads automaticamente:
            </p>
            <code className="block p-3 bg-background rounded border text-sm break-all">
              https://dteppsfseusqixuppglh.supabase.co/functions/v1/webhook-leadgen
            </code>
            <p className="text-xs text-muted-foreground">
              Selecione o campo "leadgen" nas assinaturas de webhook da página.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
