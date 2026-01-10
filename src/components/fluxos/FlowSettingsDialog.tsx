import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Calendar, Filter, Gauge, Shield } from 'lucide-react';

interface FlowSettings {
  schedule?: {
    enabled: boolean;
    days: string[];
    startTime: string;
    endTime: string;
  };
  filters?: {
    tags?: string[];
    funnels?: string[];
    stages?: string[];
    excludeTags?: string[];
  };
  limits?: {
    maxExecutionsPerDay?: number;
    maxExecutionsPerLead?: number;
    cooldownMinutes?: number;
  };
  notifications?: {
    onError: boolean;
    onComplete: boolean;
    notifyEmail?: string;
  };
}

interface FlowSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: FlowSettings;
  onSave: (settings: FlowSettings) => void;
}

const DAYS_OF_WEEK = [
  { id: 'monday', label: 'Seg' },
  { id: 'tuesday', label: 'Ter' },
  { id: 'wednesday', label: 'Qua' },
  { id: 'thursday', label: 'Qui' },
  { id: 'friday', label: 'Sex' },
  { id: 'saturday', label: 'Sáb' },
  { id: 'sunday', label: 'Dom' },
];

export function FlowSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
}: FlowSettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState<FlowSettings>(settings);

  const updateSchedule = (key: string, value: any) => {
    setLocalSettings((prev) => ({
      ...prev,
      schedule: {
        enabled: prev.schedule?.enabled || false,
        days: prev.schedule?.days || [],
        startTime: prev.schedule?.startTime || '09:00',
        endTime: prev.schedule?.endTime || '18:00',
        [key]: value,
      },
    }));
  };

  const toggleDay = (dayId: string) => {
    const currentDays = localSettings.schedule?.days || [];
    const newDays = currentDays.includes(dayId)
      ? currentDays.filter((d) => d !== dayId)
      : [...currentDays, dayId];
    updateSchedule('days', newDays);
  };

  const updateLimits = (key: string, value: any) => {
    setLocalSettings((prev) => ({
      ...prev,
      limits: {
        ...prev.limits,
        [key]: value,
      },
    }));
  };

  const updateFilters = (key: string, value: string) => {
    const values = value.split(',').map((v) => v.trim()).filter(Boolean);
    setLocalSettings((prev) => ({
      ...prev,
      filters: {
        ...prev.filters,
        [key]: values,
      },
    }));
  };

  const updateNotifications = (key: string, value: any) => {
    setLocalSettings((prev) => ({
      ...prev,
      notifications: {
        onError: prev.notifications?.onError || false,
        onComplete: prev.notifications?.onComplete || false,
        ...prev.notifications,
        [key]: value,
      },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Regras de Ativação do Fluxo
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="schedule" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="schedule" className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Horários
            </TabsTrigger>
            <TabsTrigger value="filters" className="flex items-center gap-1">
              <Filter className="h-4 w-4" />
              Filtros
            </TabsTrigger>
            <TabsTrigger value="limits" className="flex items-center gap-1">
              <Gauge className="h-4 w-4" />
              Limites
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Alertas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Horário de Funcionamento</CardTitle>
                    <CardDescription>
                      Defina quando o fluxo pode ser executado
                    </CardDescription>
                  </div>
                  <Switch
                    checked={localSettings.schedule?.enabled || false}
                    onCheckedChange={(v) => updateSchedule('enabled', v)}
                  />
                </div>
              </CardHeader>
              
              {localSettings.schedule?.enabled && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Dias da Semana</Label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <Button
                          key={day.id}
                          type="button"
                          size="sm"
                          variant={localSettings.schedule?.days?.includes(day.id) ? 'default' : 'outline'}
                          onClick={() => toggleDay(day.id)}
                          className="w-12"
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Hora de Início</Label>
                      <Input
                        type="time"
                        value={localSettings.schedule?.startTime || '09:00'}
                        onChange={(e) => updateSchedule('startTime', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hora de Término</Label>
                      <Input
                        type="time"
                        value={localSettings.schedule?.endTime || '18:00'}
                        onChange={(e) => updateSchedule('endTime', e.target.value)}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    ⚠️ Fora destes horários, o fluxo não será executado automaticamente
                  </p>
                </CardContent>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="filters" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Filtros de Execução</CardTitle>
                <CardDescription>
                  Defina quais leads/conversas podem acionar este fluxo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Apenas leads com estas tags (separar por vírgula)</Label>
                  <Input
                    placeholder="VIP, cliente, interessado"
                    value={localSettings.filters?.tags?.join(', ') || ''}
                    onChange={(e) => updateFilters('tags', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Excluir leads com estas tags</Label>
                  <Input
                    placeholder="bloqueado, spam, não-perturbe"
                    value={localSettings.filters?.excludeTags?.join(', ') || ''}
                    onChange={(e) => updateFilters('excludeTags', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Apenas leads nos funis (IDs separados por vírgula)</Label>
                  <Input
                    placeholder="ID do funil 1, ID do funil 2"
                    value={localSettings.filters?.funnels?.join(', ') || ''}
                    onChange={(e) => updateFilters('funnels', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Apenas leads nas etapas (IDs separados por vírgula)</Label>
                  <Input
                    placeholder="ID da etapa 1, ID da etapa 2"
                    value={localSettings.filters?.stages?.join(', ') || ''}
                    onChange={(e) => updateFilters('stages', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="limits" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Limites de Execução</CardTitle>
                <CardDescription>
                  Evite execuções excessivas e spam
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Máximo de execuções por dia</Label>
                  <Input
                    type="number"
                    placeholder="100"
                    value={localSettings.limits?.maxExecutionsPerDay || ''}
                    onChange={(e) => updateLimits('maxExecutionsPerDay', parseInt(e.target.value) || undefined)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe vazio para ilimitado
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Máximo de execuções por lead</Label>
                  <Input
                    type="number"
                    placeholder="1"
                    value={localSettings.limits?.maxExecutionsPerLead || ''}
                    onChange={(e) => updateLimits('maxExecutionsPerLead', parseInt(e.target.value) || undefined)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Quantas vezes este fluxo pode rodar para o mesmo lead
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Intervalo mínimo entre execuções (minutos)</Label>
                  <Input
                    type="number"
                    placeholder="5"
                    value={localSettings.limits?.cooldownMinutes || ''}
                    onChange={(e) => updateLimits('cooldownMinutes', parseInt(e.target.value) || undefined)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tempo mínimo de espera antes de executar novamente para o mesmo lead
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Notificações</CardTitle>
                <CardDescription>
                  Receba alertas sobre a execução do fluxo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Notificar em caso de erro</Label>
                    <p className="text-xs text-muted-foreground">
                      Receba um alerta quando o fluxo falhar
                    </p>
                  </div>
                  <Switch
                    checked={localSettings.notifications?.onError || false}
                    onCheckedChange={(v) => updateNotifications('onError', v)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Notificar ao completar</Label>
                    <p className="text-xs text-muted-foreground">
                      Receba um resumo diário das execuções
                    </p>
                  </div>
                  <Switch
                    checked={localSettings.notifications?.onComplete || false}
                    onCheckedChange={(v) => updateNotifications('onComplete', v)}
                  />
                </div>

                {(localSettings.notifications?.onError || localSettings.notifications?.onComplete) && (
                  <div className="space-y-2">
                    <Label>Email para notificações</Label>
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={localSettings.notifications?.notifyEmail || ''}
                      onChange={(e) => updateNotifications('notifyEmail', e.target.value)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(localSettings)}>
            Salvar Regras
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
