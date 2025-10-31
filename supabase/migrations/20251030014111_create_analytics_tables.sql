-- Dashboards personalizados
CREATE TABLE IF NOT EXISTS user_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  layout JSONB DEFAULT '[]',
  widgets JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Relatórios agendados
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  schedule TEXT CHECK (schedule IN ('daily', 'weekly', 'monthly', 'quarterly')),
  schedule_config JSONB DEFAULT '{}', -- Para configurações específicas como dia da semana, hora, etc.
  recipients TEXT[] DEFAULT '{}', -- emails
  format TEXT CHECK (format IN ('pdf', 'excel', 'csv', 'json')),
  last_sent TIMESTAMP WITH TIME ZONE,
  next_send TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cache de métricas (opcional para performance)
CREATE TABLE IF NOT EXISTS analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  filters_hash TEXT, -- hash dos filtros aplicados
  data JSONB NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
  created_by UUID REFERENCES auth.users(id)
);

-- Alertas inteligentes
CREATE TABLE IF NOT EXISTS analytics_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT CHECK (alert_type IN ('metric_threshold', 'trend_change', 'anomaly', 'goal_achievement')),
  metric_name TEXT NOT NULL,
  condition_config JSONB NOT NULL, -- { operator: '>', value: 100, period: 'daily' }
  message_template TEXT NOT NULL,
  channels TEXT[] DEFAULT '{email}', -- ['email', 'notification', 'slack', 'webhook']
  is_active BOOLEAN DEFAULT true,
  last_triggered TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Templates de dashboard
CREATE TABLE IF NOT EXISTS dashboard_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'sales', 'marketing', 'support', 'management', etc.
  layout JSONB NOT NULL,
  widgets JSONB NOT NULL,
  is_premium BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Histórico de métricas (para análise de tendências)
CREATE TABLE IF NOT EXISTS metrics_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  filters JSONB DEFAULT '{}',
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_dashboards_user_id ON user_dashboards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dashboards_default ON user_dashboards(user_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_user_id ON scheduled_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active ON scheduled_reports(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_send ON scheduled_reports(next_send) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_analytics_cache_metric_period ON analytics_cache(metric_type, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires ON analytics_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_analytics_alerts_user_id ON analytics_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_alerts_active ON analytics_alerts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_metrics_history_metric_name ON metrics_history(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_history_period ON metrics_history(period_start, period_end);

-- Políticas RLS (Row Level Security)
ALTER TABLE user_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_history ENABLE ROW LEVEL SECURITY;

-- Políticas para user_dashboards
CREATE POLICY "Users can view their own dashboards" ON user_dashboards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view public dashboards" ON user_dashboards
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can insert their own dashboards" ON user_dashboards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own dashboards" ON user_dashboards
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dashboards" ON user_dashboards
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para scheduled_reports
CREATE POLICY "Users can view their own scheduled reports" ON scheduled_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scheduled reports" ON scheduled_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled reports" ON scheduled_reports
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled reports" ON scheduled_reports
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para analytics_cache (compartilhado)
CREATE POLICY "Users can view analytics cache" ON analytics_cache
  FOR SELECT USING (true);

CREATE POLICY "Users can insert analytics cache" ON analytics_cache
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Políticas para analytics_alerts
CREATE POLICY "Users can view their own alerts" ON analytics_alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alerts" ON analytics_alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts" ON analytics_alerts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alerts" ON analytics_alerts
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para dashboard_templates (públicos)
CREATE POLICY "Anyone can view dashboard templates" ON dashboard_templates
  FOR SELECT USING (true);

CREATE POLICY "Only admins can insert dashboard templates" ON dashboard_templates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Políticas para metrics_history (compartilhado)
CREATE POLICY "Users can view metrics history" ON metrics_history
  FOR SELECT USING (true);

CREATE POLICY "Users can insert metrics history" ON metrics_history
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_dashboards_updated_at
  BEFORE UPDATE ON user_dashboards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_reports_updated_at
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analytics_alerts_updated_at
  BEFORE UPDATE ON analytics_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_templates_updated_at
  BEFORE UPDATE ON dashboard_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para limpeza automática do cache
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM analytics_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Templates de dashboard padrão
INSERT INTO dashboard_templates (name, description, category, layout, widgets) VALUES
('Dashboard Executivo', 'Visão geral completa para gestores', 'management',
 '[{"i": "kpi_cards", "x": 0, "y": 0, "w": 12, "h": 4}, {"i": "pipeline_chart", "x": 0, "y": 4, "w": 8, "h": 6}, {"i": "conversion_trends", "x": 8, "y": 4, "w": 4, "h": 6}]',
 '{"kpi_cards": {"type": "kpi_grid", "metrics": ["total_leads", "total_value", "conversion_rate", "active_deals"]}, "pipeline_chart": {"type": "funnel_chart", "data_source": "pipeline"}, "conversion_trends": {"type": "line_chart", "metric": "conversion_rate", "period": "30_days"}}'),

('Dashboard de Vendas', 'Foco em métricas de vendas e pipeline', 'sales',
 '[{"i": "sales_kpis", "x": 0, "y": 0, "w": 12, "h": 4}, {"i": "pipeline_visual", "x": 0, "y": 4, "w": 12, "h": 8}, {"i": "sales_trends", "x": 0, "y": 12, "w": 6, "h": 6}, {"i": "top_performers", "x": 6, "y": 12, "w": 6, "h": 6}]',
 '{"sales_kpis": {"type": "kpi_grid", "metrics": ["won_deals", "pipeline_value", "avg_deal_size", "sales_velocity"]}, "pipeline_visual": {"type": "pipeline_funnel", "show_values": true}, "sales_trends": {"type": "area_chart", "metric": "monthly_sales"}, "top_performers": {"type": "leaderboard", "metric": "sales_volume", "limit": 10}}'),

('Dashboard de Marketing', 'Métricas de comunicação e engajamento', 'marketing',
 '[{"i": "communication_kpis", "x": 0, "y": 0, "w": 12, "h": 4}, {"i": "channel_performance", "x": 0, "y": 4, "w": 6, "h": 6}, {"i": "response_analysis", "x": 6, "y": 4, "w": 6, "h": 6}, {"i": "engagement_trends", "x": 0, "y": 10, "w": 12, "h": 6}]',
 '{"communication_kpis": {"type": "kpi_grid", "metrics": ["total_conversations", "response_rate", "avg_response_time", "customer_satisfaction"]}, "channel_performance": {"type": "bar_chart", "group_by": "channel"}, "response_analysis": {"type": "heatmap", "metric": "response_time", "group_by": "hour"}, "engagement_trends": {"type": "line_chart", "metric": "engagement_rate"}}'),

('Dashboard de Produtividade', 'Métricas de tarefas e eficiência', 'productivity',
 '[{"i": "productivity_kpis", "x": 0, "y": 0, "w": 12, "h": 4}, {"i": "task_completion", "x": 0, "y": 4, "w": 6, "h": 6}, {"i": "team_performance", "x": 6, "y": 4, "w": 6, "h": 6}, {"i": "time_tracking", "x": 0, "y": 10, "w": 12, "h": 6}]',
 '{"productivity_kpis": {"type": "kpi_grid", "metrics": ["tasks_completed", "completion_rate", "avg_task_time", "team_utilization"]}, "task_completion": {"type": "donut_chart", "metric": "task_status"}, "team_performance": {"type": "leaderboard", "metric": "tasks_completed"}, "time_tracking": {"type": "bar_chart", "metric": "time_spent", "group_by": "task_type"}}')
ON CONFLICT (name) DO NOTHING;


