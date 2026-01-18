export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agendas: {
        Row: {
          capacidade_simultanea: number | null
          company_id: string | null
          created_at: string | null
          disponibilidade: Json | null
          id: string
          nome: string
          owner_id: string
          permite_simultaneo: boolean | null
          responsavel_id: string | null
          slug: string | null
          status: string | null
          tempo_medio_servico: number | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          capacidade_simultanea?: number | null
          company_id?: string | null
          created_at?: string | null
          disponibilidade?: Json | null
          id?: string
          nome: string
          owner_id: string
          permite_simultaneo?: boolean | null
          responsavel_id?: string | null
          slug?: string | null
          status?: string | null
          tempo_medio_servico?: number | null
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          capacidade_simultanea?: number | null
          company_id?: string | null
          created_at?: string | null
          disponibilidade?: Json | null
          id?: string
          nome?: string
          owner_id?: string
          permite_simultaneo?: boolean | null
          responsavel_id?: string | null
          slug?: string | null
          status?: string | null
          tempo_medio_servico?: number | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_process_suggestions: {
        Row: {
          approved: boolean | null
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string | null
          details: Json | null
          id: string
          rejected_reason: string | null
          status: string | null
          suggestion_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          rejected_reason?: string | null
          status?: string | null
          suggestion_type: string
          title: string
          updated_at?: string | null
        }
        Update: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          rejected_reason?: string | null
          status?: string | null
          suggestion_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_process_suggestions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_flow_logs: {
        Row: {
          company_id: string
          completed_at: string | null
          conversation_id: string | null
          error_message: string | null
          execution_data: Json | null
          flow_id: string
          id: string
          lead_id: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          conversation_id?: string | null
          error_message?: string | null
          execution_data?: Json | null
          flow_id: string
          id?: string
          lead_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          conversation_id?: string | null
          error_message?: string | null
          execution_data?: Json | null
          flow_id?: string
          id?: string
          lead_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_flow_logs_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_flows: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string | null
          description: string | null
          edges: Json | null
          id: string
          name: string
          nodes: Json | null
          owner_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string | null
          description?: string | null
          edges?: Json | null
          id?: string
          name: string
          nodes?: Json | null
          owner_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          edges?: Json | null
          id?: string
          name?: string
          nodes?: Json | null
          owner_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      blocked_groups: {
        Row: {
          blocked_at: string
          company_id: string
          created_at: string
          group_name: string | null
          group_number: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          blocked_at?: string
          company_id: string
          created_at?: string
          group_name?: string | null
          group_number: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          blocked_at?: string
          company_id?: string
          created_at?: string
          group_name?: string | null
          group_number?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      call_history: {
        Row: {
          call_end: string | null
          call_result: string | null
          call_start: string
          company_id: string
          created_at: string
          duration_seconds: number | null
          id: string
          lead_id: string | null
          lead_name: string | null
          notes: string | null
          notes_required: boolean | null
          phone_number: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          call_end?: string | null
          call_result?: string | null
          call_start?: string
          company_id: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          lead_id?: string | null
          lead_name?: string | null
          notes?: string | null
          notes_required?: boolean | null
          phone_number: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          call_end?: string | null
          call_result?: string | null
          call_start?: string
          company_id?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          lead_id?: string | null
          lead_name?: string | null
          notes?: string | null
          notes_required?: boolean | null
          phone_number?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          allow_ai_features: boolean | null
          allow_automacao: boolean | null
          allow_chat_equipe: boolean | null
          allow_discador: boolean | null
          allow_group_messages: boolean | null
          allow_processos_comerciais: boolean | null
          allow_reunioes: boolean | null
          cnpj: string | null
          created_at: string | null
          created_by: string | null
          domain: string | null
          id: string
          is_master_account: boolean | null
          max_leads: number | null
          max_users: number | null
          max_whatsapp_messages: number | null
          name: string
          owner_user_id: string | null
          parent_company_id: string | null
          plan: string | null
          settings: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          allow_ai_features?: boolean | null
          allow_automacao?: boolean | null
          allow_chat_equipe?: boolean | null
          allow_discador?: boolean | null
          allow_group_messages?: boolean | null
          allow_processos_comerciais?: boolean | null
          allow_reunioes?: boolean | null
          cnpj?: string | null
          created_at?: string | null
          created_by?: string | null
          domain?: string | null
          id?: string
          is_master_account?: boolean | null
          max_leads?: number | null
          max_users?: number | null
          max_whatsapp_messages?: number | null
          name: string
          owner_user_id?: string | null
          parent_company_id?: string | null
          plan?: string | null
          settings?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          allow_ai_features?: boolean | null
          allow_automacao?: boolean | null
          allow_chat_equipe?: boolean | null
          allow_discador?: boolean | null
          allow_group_messages?: boolean | null
          allow_processos_comerciais?: boolean | null
          allow_reunioes?: boolean | null
          cnpj?: string | null
          created_at?: string | null
          created_by?: string | null
          domain?: string | null
          id?: string
          is_master_account?: boolean | null
          max_leads?: number | null
          max_users?: number | null
          max_whatsapp_messages?: number | null
          name?: string
          owner_user_id?: string | null
          parent_company_id?: string | null
          plan?: string | null
          settings?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_parent_company_id_fkey"
            columns: ["parent_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      compromissos: {
        Row: {
          agenda_id: string | null
          company_id: string | null
          created_at: string | null
          custo_estimado: number | null
          data_hora_fim: string
          data_hora_inicio: string
          duracao: number | null
          id: string
          lead_id: string | null
          lembrete_enviado: boolean | null
          observacoes: string | null
          owner_id: string
          paciente: string | null
          profissional_id: string | null
          status: string | null
          telefone: string | null
          tipo_servico: string
          titulo: string | null
          updated_at: string | null
          usuario_responsavel_id: string
        }
        Insert: {
          agenda_id?: string | null
          company_id?: string | null
          created_at?: string | null
          custo_estimado?: number | null
          data_hora_fim: string
          data_hora_inicio: string
          duracao?: number | null
          id?: string
          lead_id?: string | null
          lembrete_enviado?: boolean | null
          observacoes?: string | null
          owner_id: string
          paciente?: string | null
          profissional_id?: string | null
          status?: string | null
          telefone?: string | null
          tipo_servico: string
          titulo?: string | null
          updated_at?: string | null
          usuario_responsavel_id: string
        }
        Update: {
          agenda_id?: string | null
          company_id?: string | null
          created_at?: string | null
          custo_estimado?: number | null
          data_hora_fim?: string
          data_hora_inicio?: string
          duracao?: number | null
          id?: string
          lead_id?: string | null
          lembrete_enviado?: boolean | null
          observacoes?: string | null
          owner_id?: string
          paciente?: string | null
          profissional_id?: string | null
          status?: string | null
          telefone?: string | null
          tipo_servico?: string
          titulo?: string | null
          updated_at?: string | null
          usuario_responsavel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compromissos_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "agendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compromissos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compromissos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compromissos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      conversas: {
        Row: {
          ad_headline: string | null
          ad_source_id: string | null
          ad_source_type: string | null
          arquivo_nome: string | null
          assigned_user_id: string | null
          campanha_id: string | null
          campanha_nome: string | null
          company_id: string | null
          created_at: string | null
          ctwa_clid: string | null
          delivered: boolean | null
          fila_id: string | null
          fromme: boolean | null
          id: string
          is_group: boolean | null
          lead_id: string | null
          mensagem: string
          midia_url: string | null
          nome_contato: string | null
          numero: string
          origem: string
          origem_api: string | null
          owner_id: string | null
          read: boolean | null
          replied_to_id: string | null
          replied_to_message: string | null
          sent_by: string | null
          status: string
          telefone_formatado: string | null
          tipo_mensagem: string | null
          updated_at: string | null
        }
        Insert: {
          ad_headline?: string | null
          ad_source_id?: string | null
          ad_source_type?: string | null
          arquivo_nome?: string | null
          assigned_user_id?: string | null
          campanha_id?: string | null
          campanha_nome?: string | null
          company_id?: string | null
          created_at?: string | null
          ctwa_clid?: string | null
          delivered?: boolean | null
          fila_id?: string | null
          fromme?: boolean | null
          id?: string
          is_group?: boolean | null
          lead_id?: string | null
          mensagem: string
          midia_url?: string | null
          nome_contato?: string | null
          numero: string
          origem?: string
          origem_api?: string | null
          owner_id?: string | null
          read?: boolean | null
          replied_to_id?: string | null
          replied_to_message?: string | null
          sent_by?: string | null
          status?: string
          telefone_formatado?: string | null
          tipo_mensagem?: string | null
          updated_at?: string | null
        }
        Update: {
          ad_headline?: string | null
          ad_source_id?: string | null
          ad_source_type?: string | null
          arquivo_nome?: string | null
          assigned_user_id?: string | null
          campanha_id?: string | null
          campanha_nome?: string | null
          company_id?: string | null
          created_at?: string | null
          ctwa_clid?: string | null
          delivered?: boolean | null
          fila_id?: string | null
          fromme?: boolean | null
          id?: string
          is_group?: boolean | null
          lead_id?: string | null
          mensagem?: string
          midia_url?: string | null
          nome_contato?: string | null
          numero?: string
          origem?: string
          origem_api?: string | null
          owner_id?: string | null
          read?: boolean | null
          replied_to_id?: string | null
          replied_to_message?: string | null
          sent_by?: string | null
          status?: string
          telefone_formatado?: string | null
          tipo_mensagem?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_fila_id_fkey"
            columns: ["fila_id"]
            isOneToOne: false
            referencedRelation: "filas_atendimento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_assignments: {
        Row: {
          assigned_user_id: string | null
          company_id: string
          created_at: string | null
          id: string
          queue_id: string | null
          telefone_formatado: string
          updated_at: string | null
        }
        Insert: {
          assigned_user_id?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          queue_id?: string | null
          telefone_formatado: string
          updated_at?: string | null
        }
        Update: {
          assigned_user_id?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          queue_id?: string | null
          telefone_formatado?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_assignments_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "support_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      etapas: {
        Row: {
          atualizado_em: string | null
          company_id: string | null
          cor: string | null
          criado_em: string | null
          funil_id: string | null
          id: string
          nome: string
          posicao: number | null
        }
        Insert: {
          atualizado_em?: string | null
          company_id?: string | null
          cor?: string | null
          criado_em?: string | null
          funil_id?: string | null
          id?: string
          nome: string
          posicao?: number | null
        }
        Update: {
          atualizado_em?: string | null
          company_id?: string | null
          cor?: string | null
          criado_em?: string | null
          funil_id?: string | null
          id?: string
          nome?: string
          posicao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "etapas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "etapas_funil_id_fkey"
            columns: ["funil_id"]
            isOneToOne: false
            referencedRelation: "funis"
            referencedColumns: ["id"]
          },
        ]
      }
      filas_atendimento: {
        Row: {
          ativa: boolean | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          owner_id: string
          prioridade: number | null
          updated_at: string | null
        }
        Insert: {
          ativa?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          owner_id: string
          prioridade?: number | null
          updated_at?: string | null
        }
        Update: {
          ativa?: boolean | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          owner_id?: string
          prioridade?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      funis: {
        Row: {
          atualizado_em: string | null
          company_id: string | null
          criado_em: string | null
          descricao: string | null
          id: string
          nome: string
          owner_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          company_id?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome: string
          owner_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          company_id?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funis_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funis_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_cadence_rules: {
        Row: {
          avoid_hours: Json | null
          best_contact_hours: Json | null
          channels_sequence: Json | null
          company_id: string
          created_at: string | null
          days_between_contacts: number | null
          description: string | null
          escalate_after_attempts: number | null
          escalate_to_user_id: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          max_attempts: number | null
          name: string
          priority: number | null
          target_funnels: string[] | null
          target_stages: string[] | null
          target_tags: string[] | null
          target_temperature: string[] | null
          updated_at: string | null
        }
        Insert: {
          avoid_hours?: Json | null
          best_contact_hours?: Json | null
          channels_sequence?: Json | null
          company_id: string
          created_at?: string | null
          days_between_contacts?: number | null
          description?: string | null
          escalate_after_attempts?: number | null
          escalate_to_user_id?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          max_attempts?: number | null
          name: string
          priority?: number | null
          target_funnels?: string[] | null
          target_stages?: string[] | null
          target_tags?: string[] | null
          target_temperature?: string[] | null
          updated_at?: string | null
        }
        Update: {
          avoid_hours?: Json | null
          best_contact_hours?: Json | null
          channels_sequence?: Json | null
          company_id?: string
          created_at?: string | null
          days_between_contacts?: number | null
          description?: string | null
          escalate_after_attempts?: number | null
          escalate_to_user_id?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          max_attempts?: number | null
          name?: string
          priority?: number | null
          target_funnels?: string[] | null
          target_stages?: string[] | null
          target_tags?: string[] | null
          target_temperature?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ia_cadence_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_commercial_alerts: {
        Row: {
          action_buttons: Json | null
          action_data: Json | null
          actioned_at: string | null
          actioned_by: string | null
          alert_type: string
          auto_action_data: Json | null
          auto_action_type: string | null
          company_id: string
          conversation_id: string | null
          created_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          lead_id: string | null
          recommended_action: string | null
          seen_at: string | null
          severity: string | null
          status: string | null
          title: string
        }
        Insert: {
          action_buttons?: Json | null
          action_data?: Json | null
          actioned_at?: string | null
          actioned_by?: string | null
          alert_type: string
          auto_action_data?: Json | null
          auto_action_type?: string | null
          company_id: string
          conversation_id?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          lead_id?: string | null
          recommended_action?: string | null
          seen_at?: string | null
          severity?: string | null
          status?: string | null
          title: string
        }
        Update: {
          action_buttons?: Json | null
          action_data?: Json | null
          actioned_at?: string | null
          actioned_by?: string | null
          alert_type?: string
          auto_action_data?: Json | null
          auto_action_type?: string | null
          company_id?: string
          conversation_id?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          lead_id?: string | null
          recommended_action?: string | null
          seen_at?: string | null
          severity?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ia_commercial_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_commercial_alerts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_commercial_metrics: {
        Row: {
          avg_engagement_score: number | null
          avg_response_rate: number | null
          avg_response_time_minutes: number | null
          company_id: string
          completed_followups: number | null
          conversion_rate: number | null
          created_at: string | null
          id: string
          leads_cold: number | null
          leads_hot: number | null
          leads_warm: number | null
          metric_date: string
          metrics_data: Json | null
          opportunities_detected: number | null
          overdue_followups: number | null
          pending_followups: number | null
          risks_detected: number | null
          top_objections: Json | null
          total_calls_made: number | null
          total_leads_monitored: number | null
          total_meetings_scheduled: number | null
          total_messages_received: number | null
          total_messages_sent: number | null
          updated_at: string | null
        }
        Insert: {
          avg_engagement_score?: number | null
          avg_response_rate?: number | null
          avg_response_time_minutes?: number | null
          company_id: string
          completed_followups?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          id?: string
          leads_cold?: number | null
          leads_hot?: number | null
          leads_warm?: number | null
          metric_date?: string
          metrics_data?: Json | null
          opportunities_detected?: number | null
          overdue_followups?: number | null
          pending_followups?: number | null
          risks_detected?: number | null
          top_objections?: Json | null
          total_calls_made?: number | null
          total_leads_monitored?: number | null
          total_meetings_scheduled?: number | null
          total_messages_received?: number | null
          total_messages_sent?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_engagement_score?: number | null
          avg_response_rate?: number | null
          avg_response_time_minutes?: number | null
          company_id?: string
          completed_followups?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          id?: string
          leads_cold?: number | null
          leads_hot?: number | null
          leads_warm?: number | null
          metric_date?: string
          metrics_data?: Json | null
          opportunities_detected?: number | null
          overdue_followups?: number | null
          pending_followups?: number | null
          risks_detected?: number | null
          top_objections?: Json | null
          total_calls_made?: number | null
          total_leads_monitored?: number | null
          total_meetings_scheduled?: number | null
          total_messages_received?: number | null
          total_messages_sent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ia_commercial_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_configurations: {
        Row: {
          auto_optimization: boolean | null
          block_by_funnel: boolean | null
          block_by_tags: boolean | null
          blocked_funnels: string[] | null
          blocked_stages: string[] | null
          blocked_tags: string[] | null
          collaborative_mode: boolean | null
          company_id: string
          created_at: string | null
          custom_prompts: Json | null
          history_messages_count: number | null
          id: string
          learning_mode: boolean | null
          read_conversation_history: boolean | null
          training_preferences: Json | null
          updated_at: string | null
        }
        Insert: {
          auto_optimization?: boolean | null
          block_by_funnel?: boolean | null
          block_by_tags?: boolean | null
          blocked_funnels?: string[] | null
          blocked_stages?: string[] | null
          blocked_tags?: string[] | null
          collaborative_mode?: boolean | null
          company_id: string
          created_at?: string | null
          custom_prompts?: Json | null
          history_messages_count?: number | null
          id?: string
          learning_mode?: boolean | null
          read_conversation_history?: boolean | null
          training_preferences?: Json | null
          updated_at?: string | null
        }
        Update: {
          auto_optimization?: boolean | null
          block_by_funnel?: boolean | null
          block_by_tags?: boolean | null
          blocked_funnels?: string[] | null
          blocked_stages?: string[] | null
          blocked_tags?: string[] | null
          collaborative_mode?: boolean | null
          company_id?: string
          created_at?: string | null
          custom_prompts?: Json | null
          history_messages_count?: number | null
          id?: string
          learning_mode?: boolean | null
          read_conversation_history?: boolean | null
          training_preferences?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ia_lead_intelligence: {
        Row: {
          analysis_version: number | null
          avg_response_time_minutes: number | null
          company_id: string
          conversation_sentiment: string | null
          created_at: string | null
          days_since_last_contact: number | null
          decision_makers: Json | null
          detected_intent: string | null
          engagement_score: number | null
          id: string
          interests: Json | null
          key_topics: Json | null
          last_analysis_at: string | null
          last_message_summary: string | null
          lead_id: string
          next_action_date: string | null
          objections: Json | null
          purchase_intent: number | null
          recommended_action: string | null
          recommended_channel: string | null
          response_rate: number | null
          suggested_script: string | null
          temperature: string | null
          total_contact_attempts: number | null
          updated_at: string | null
        }
        Insert: {
          analysis_version?: number | null
          avg_response_time_minutes?: number | null
          company_id: string
          conversation_sentiment?: string | null
          created_at?: string | null
          days_since_last_contact?: number | null
          decision_makers?: Json | null
          detected_intent?: string | null
          engagement_score?: number | null
          id?: string
          interests?: Json | null
          key_topics?: Json | null
          last_analysis_at?: string | null
          last_message_summary?: string | null
          lead_id: string
          next_action_date?: string | null
          objections?: Json | null
          purchase_intent?: number | null
          recommended_action?: string | null
          recommended_channel?: string | null
          response_rate?: number | null
          suggested_script?: string | null
          temperature?: string | null
          total_contact_attempts?: number | null
          updated_at?: string | null
        }
        Update: {
          analysis_version?: number | null
          avg_response_time_minutes?: number | null
          company_id?: string
          conversation_sentiment?: string | null
          created_at?: string | null
          days_since_last_contact?: number | null
          decision_makers?: Json | null
          detected_intent?: string | null
          engagement_score?: number | null
          id?: string
          interests?: Json | null
          key_topics?: Json | null
          last_analysis_at?: string | null
          last_message_summary?: string | null
          lead_id?: string
          next_action_date?: string | null
          objections?: Json | null
          purchase_intent?: number | null
          recommended_action?: string | null
          recommended_channel?: string | null
          response_rate?: number | null
          suggested_script?: string | null
          temperature?: string | null
          total_contact_attempts?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ia_lead_intelligence_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_lead_intelligence_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_metrics: {
        Row: {
          agent_type: string
          avg_confidence_score: number | null
          avg_response_accuracy: number | null
          company_id: string
          conversions_assisted: number | null
          corrections_needed: number | null
          created_at: string | null
          id: string
          learning_progress: number | null
          metric_date: string | null
          metrics_data: Json | null
          successful_interactions: number | null
          total_interactions: number | null
          updated_at: string | null
        }
        Insert: {
          agent_type: string
          avg_confidence_score?: number | null
          avg_response_accuracy?: number | null
          company_id: string
          conversions_assisted?: number | null
          corrections_needed?: number | null
          created_at?: string | null
          id?: string
          learning_progress?: number | null
          metric_date?: string | null
          metrics_data?: Json | null
          successful_interactions?: number | null
          total_interactions?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_type?: string
          avg_confidence_score?: number | null
          avg_response_accuracy?: number | null
          company_id?: string
          conversions_assisted?: number | null
          corrections_needed?: number | null
          created_at?: string | null
          id?: string
          learning_progress?: number | null
          metric_date?: string | null
          metrics_data?: Json | null
          successful_interactions?: number | null
          total_interactions?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ia_patterns: {
        Row: {
          company_id: string
          confidence_score: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_validated_at: string | null
          pattern_data: Json
          pattern_name: string
          pattern_type: string
          times_validated: number | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_validated_at?: string | null
          pattern_data: Json
          pattern_name: string
          pattern_type: string
          times_validated?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_validated_at?: string | null
          pattern_data?: Json
          pattern_name?: string
          pattern_type?: string
          times_validated?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ia_recommendations: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          company_id: string
          conversation_id: string | null
          created_at: string | null
          id: string
          lead_id: string | null
          priority: string | null
          recommendation_data: Json | null
          recommendation_text: string
          recommendation_type: string
          status: string | null
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          company_id: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          priority?: string | null
          recommendation_data?: Json | null
          recommendation_text: string
          recommendation_type: string
          status?: string | null
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          company_id?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          priority?: string | null
          recommendation_data?: Json | null
          recommendation_text?: string
          recommendation_type?: string
          status?: string | null
        }
        Relationships: []
      }
      ia_scripts: {
        Row: {
          company_id: string
          conversion_count: number | null
          created_at: string | null
          description: string | null
          example_usage: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          name: string
          script_template: string
          success_count: number | null
          success_rate: number | null
          tags: string[] | null
          target_channel: string | null
          target_temperature: string[] | null
          times_used: number | null
          trigger_context: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          company_id: string
          conversion_count?: number | null
          created_at?: string | null
          description?: string | null
          example_usage?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name: string
          script_template: string
          success_count?: number | null
          success_rate?: number | null
          tags?: string[] | null
          target_channel?: string | null
          target_temperature?: string[] | null
          times_used?: number | null
          trigger_context: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          company_id?: string
          conversion_count?: number | null
          created_at?: string | null
          description?: string | null
          example_usage?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          name?: string
          script_template?: string
          success_count?: number | null
          success_rate?: number | null
          tags?: string[] | null
          target_channel?: string | null
          target_temperature?: string[] | null
          times_used?: number | null
          trigger_context?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ia_scripts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_scripts_generated: {
        Row: {
          company_id: string
          context: string
          created_at: string | null
          got_response: boolean | null
          id: string
          key_points: string[] | null
          lead_id: string
          objections_addressed: string[] | null
          response_time_minutes: number | null
          script_content: string
          suggested_channel: string | null
          updated_at: string | null
          was_used: boolean | null
        }
        Insert: {
          company_id: string
          context: string
          created_at?: string | null
          got_response?: boolean | null
          id?: string
          key_points?: string[] | null
          lead_id: string
          objections_addressed?: string[] | null
          response_time_minutes?: number | null
          script_content: string
          suggested_channel?: string | null
          updated_at?: string | null
          was_used?: boolean | null
        }
        Update: {
          company_id?: string
          context?: string
          created_at?: string | null
          got_response?: boolean | null
          id?: string
          key_points?: string[] | null
          lead_id?: string
          objections_addressed?: string[] | null
          response_time_minutes?: number | null
          script_content?: string
          suggested_channel?: string | null
          updated_at?: string | null
          was_used?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ia_scripts_generated_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ia_scripts_generated_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ia_training_data: {
        Row: {
          agent_type: string
          ai_response: string
          company_id: string
          context_data: Json | null
          conversation_id: string | null
          created_at: string | null
          feedback_score: number | null
          human_correction: string | null
          id: string
          input_message: string
          lead_id: string | null
          resulted_in_conversion: boolean | null
          updated_at: string | null
          was_corrected: boolean | null
        }
        Insert: {
          agent_type: string
          ai_response: string
          company_id: string
          context_data?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          feedback_score?: number | null
          human_correction?: string | null
          id?: string
          input_message: string
          lead_id?: string | null
          resulted_in_conversion?: boolean | null
          updated_at?: string | null
          was_corrected?: boolean | null
        }
        Update: {
          agent_type?: string
          ai_response?: string
          company_id?: string
          context_data?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          feedback_score?: number | null
          human_correction?: string | null
          id?: string
          input_message?: string
          lead_id?: string | null
          resulted_in_conversion?: boolean | null
          updated_at?: string | null
          was_corrected?: boolean | null
        }
        Relationships: []
      }
      internal_conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_conversations: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          id: string
          is_group: boolean
          name: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          is_group?: boolean
          name?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_group?: boolean
          name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          file_name: string | null
          id: string
          media_url: string | null
          message_type: string
          sender_id: string
          shared_item_id: string | null
          shared_item_type: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          file_name?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          sender_id: string
          shared_item_id?: string | null
          shared_item_type?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          file_name?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          sender_id?: string
          shared_item_id?: string | null
          shared_item_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_ad_forms: {
        Row: {
          auto_etapa_id: string | null
          auto_funil_id: string | null
          auto_qualify_with_ia: boolean | null
          auto_responsavel_id: string | null
          auto_tags: string[] | null
          company_id: string | null
          created_at: string | null
          form_id: string
          form_name: string | null
          id: string
          notify_phone: string | null
          notify_whatsapp: boolean | null
          page_id: string
          qualification_prompt: string | null
          updated_at: string | null
        }
        Insert: {
          auto_etapa_id?: string | null
          auto_funil_id?: string | null
          auto_qualify_with_ia?: boolean | null
          auto_responsavel_id?: string | null
          auto_tags?: string[] | null
          company_id?: string | null
          created_at?: string | null
          form_id: string
          form_name?: string | null
          id?: string
          notify_phone?: string | null
          notify_whatsapp?: boolean | null
          page_id: string
          qualification_prompt?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_etapa_id?: string | null
          auto_funil_id?: string | null
          auto_qualify_with_ia?: boolean | null
          auto_responsavel_id?: string | null
          auto_tags?: string[] | null
          company_id?: string | null
          created_at?: string | null
          form_id?: string
          form_name?: string | null
          id?: string
          notify_phone?: string | null
          notify_whatsapp?: boolean | null
          page_id?: string
          qualification_prompt?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_ad_forms_auto_etapa_id_fkey"
            columns: ["auto_etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_ad_forms_auto_funil_id_fkey"
            columns: ["auto_funil_id"]
            isOneToOne: false
            referencedRelation: "funis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_ad_forms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_attachments: {
        Row: {
          category: string | null
          company_id: string
          created_at: string | null
          description: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          lead_id: string
          mime_type: string | null
          treatment_date: string | null
          treatment_name: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string | null
          description?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          lead_id: string
          mime_type?: string | null
          treatment_date?: string | null
          treatment_name?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          lead_id?: string
          mime_type?: string | null
          treatment_date?: string | null
          treatment_name?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_attachments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_cadence_progress: {
        Row: {
          assigned_to: string | null
          cadence_config: Json | null
          cadence_name: string
          cadence_rule_id: string | null
          cadence_steps: Json | null
          company_id: string
          completed_at: string | null
          completed_steps: Json | null
          created_at: string
          current_step: number
          id: string
          lead_id: string
          next_action_at: string | null
          next_action_channel: string | null
          next_action_description: string | null
          notes: string | null
          started_at: string
          status: string
          total_steps: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          cadence_config?: Json | null
          cadence_name: string
          cadence_rule_id?: string | null
          cadence_steps?: Json | null
          company_id: string
          completed_at?: string | null
          completed_steps?: Json | null
          created_at?: string
          current_step?: number
          id?: string
          lead_id: string
          next_action_at?: string | null
          next_action_channel?: string | null
          next_action_description?: string | null
          notes?: string | null
          started_at?: string
          status?: string
          total_steps?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          cadence_config?: Json | null
          cadence_name?: string
          cadence_rule_id?: string | null
          cadence_steps?: Json | null
          company_id?: string
          completed_at?: string | null
          completed_steps?: Json | null
          created_at?: string
          current_step?: number
          id?: string
          lead_id?: string
          next_action_at?: string | null
          next_action_channel?: string | null
          next_action_description?: string | null
          notes?: string | null
          started_at?: string
          status?: string
          total_steps?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_cadence_progress_cadence_rule_id_fkey"
            columns: ["cadence_rule_id"]
            isOneToOne: false
            referencedRelation: "ia_cadence_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cadence_progress_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cadence_progress_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_value_history: {
        Row: {
          change_type: string
          changed_by: string | null
          company_id: string
          created_at: string | null
          id: string
          lead_id: string
          new_etapa_id: string | null
          new_status: string | null
          new_value: number | null
          notes: string | null
          old_etapa_id: string | null
          old_status: string | null
          old_value: number | null
          value_change: number | null
        }
        Insert: {
          change_type: string
          changed_by?: string | null
          company_id: string
          created_at?: string | null
          id?: string
          lead_id: string
          new_etapa_id?: string | null
          new_status?: string | null
          new_value?: number | null
          notes?: string | null
          old_etapa_id?: string | null
          old_status?: string | null
          old_value?: number | null
          value_change?: number | null
        }
        Update: {
          change_type?: string
          changed_by?: string | null
          company_id?: string
          created_at?: string | null
          id?: string
          lead_id?: string
          new_etapa_id?: string | null
          new_status?: string | null
          new_value?: number | null
          notes?: string | null
          old_etapa_id?: string | null
          old_status?: string | null
          old_value?: number | null
          value_change?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_value_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_value_history_new_etapa_id_fkey"
            columns: ["new_etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_value_history_old_etapa_id_fkey"
            columns: ["old_etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ad_creative_name: string | null
          ad_id: string | null
          adset_id: string | null
          campaign_id: string | null
          company: string | null
          company_id: string | null
          conversion_timestamp: string | null
          cpf: string | null
          created_at: string | null
          email: string | null
          etapa_id: string | null
          expected_close_date: string | null
          form_id: string | null
          funil_id: string | null
          id: string
          lead_source_type: string | null
          loss_reason: string | null
          lost_at: string | null
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          probability: number | null
          produto_id: string | null
          profile_picture_url: string | null
          responsaveis: string[] | null
          responsavel_id: string | null
          segmentacao: string | null
          servico: string | null
          source: string | null
          stage: string | null
          status: string | null
          tags: string[] | null
          telefone: string | null
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          value: number | null
          won_at: string | null
        }
        Insert: {
          ad_creative_name?: string | null
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          company?: string | null
          company_id?: string | null
          conversion_timestamp?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          etapa_id?: string | null
          expected_close_date?: string | null
          form_id?: string | null
          funil_id?: string | null
          id?: string
          lead_source_type?: string | null
          loss_reason?: string | null
          lost_at?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          probability?: number | null
          produto_id?: string | null
          profile_picture_url?: string | null
          responsaveis?: string[] | null
          responsavel_id?: string | null
          segmentacao?: string | null
          servico?: string | null
          source?: string | null
          stage?: string | null
          status?: string | null
          tags?: string[] | null
          telefone?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number | null
          won_at?: string | null
        }
        Update: {
          ad_creative_name?: string | null
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          company?: string | null
          company_id?: string | null
          conversion_timestamp?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          etapa_id?: string | null
          expected_close_date?: string | null
          form_id?: string | null
          funil_id?: string | null
          id?: string
          lead_source_type?: string | null
          loss_reason?: string | null
          lost_at?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          probability?: number | null
          produto_id?: string | null
          profile_picture_url?: string | null
          responsaveis?: string[] | null
          responsavel_id?: string | null
          segmentacao?: string | null
          servico?: string | null
          source?: string | null
          stage?: string | null
          status?: string | null
          tags?: string[] | null
          telefone?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number | null
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_etapa"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_funil"
            columns: ["funil_id"]
            isOneToOne: false
            referencedRelation: "funis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      lembretes: {
        Row: {
          ativo: boolean | null
          canal: string
          company_id: string | null
          compromisso_id: string
          created_at: string | null
          data_envio: string | null
          data_hora_envio: string | null
          destinatario: string
          horas_antecedencia: number
          id: string
          mensagem: string | null
          midia_url: string | null
          proxima_data_envio: string | null
          proxima_tentativa: string | null
          recorrencia: string | null
          status_envio: string | null
          telefone_responsavel: string | null
          tentativas: number | null
        }
        Insert: {
          ativo?: boolean | null
          canal: string
          company_id?: string | null
          compromisso_id: string
          created_at?: string | null
          data_envio?: string | null
          data_hora_envio?: string | null
          destinatario?: string
          horas_antecedencia?: number
          id?: string
          mensagem?: string | null
          midia_url?: string | null
          proxima_data_envio?: string | null
          proxima_tentativa?: string | null
          recorrencia?: string | null
          status_envio?: string | null
          telefone_responsavel?: string | null
          tentativas?: number | null
        }
        Update: {
          ativo?: boolean | null
          canal?: string
          company_id?: string | null
          compromisso_id?: string
          created_at?: string | null
          data_envio?: string | null
          data_hora_envio?: string | null
          destinatario?: string
          horas_antecedencia?: number
          id?: string
          mensagem?: string | null
          midia_url?: string | null
          proxima_data_envio?: string | null
          proxima_tentativa?: string | null
          recorrencia?: string | null
          status_envio?: string | null
          telefone_responsavel?: string | null
          tentativas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lembretes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lembretes_compromisso_id_fkey"
            columns: ["compromisso_id"]
            isOneToOne: false
            referencedRelation: "compromissos"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_signals: {
        Row: {
          created_at: string
          from_user: string
          id: string
          meeting_id: string
          signal_data: Json | null
          signal_type: string
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          meeting_id: string
          signal_data?: Json | null
          signal_type: string
          to_user: string
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          meeting_id?: string
          signal_data?: Json | null
          signal_type?: string
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_signals_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          call_type: string
          company_id: string
          created_at: string
          created_by: string
          ended_at: string | null
          id: string
          meeting_type: string
          notes: string | null
          participant_names: string[] | null
          participants: string[] | null
          public_link: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          call_type?: string
          company_id: string
          created_at?: string
          created_by: string
          ended_at?: string | null
          id?: string
          meeting_type?: string
          notes?: string | null
          participant_names?: string[] | null
          participants?: string[] | null
          public_link?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          call_type?: string
          company_id?: string
          created_at?: string
          created_by?: string
          ended_at?: string | null
          id?: string
          meeting_type?: string
          notes?: string | null
          participant_names?: string[] | null
          participants?: string[] | null
          public_link?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          lida: boolean
          mensagem: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo: string
          titulo: string
          usuario_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          id: string
          module: string
          name: string
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          id?: string
          module: string
          name: string
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          id?: string
          module?: string
          name?: string
        }
        Relationships: []
      }
      process_blocks: {
        Row: {
          block_type: string
          content: Json
          created_at: string | null
          id: string
          page_id: string
          parent_block_id: string | null
          position: number | null
          properties: Json | null
          updated_at: string | null
        }
        Insert: {
          block_type?: string
          content?: Json
          created_at?: string | null
          id?: string
          page_id: string
          parent_block_id?: string | null
          position?: number | null
          properties?: Json | null
          updated_at?: string | null
        }
        Update: {
          block_type?: string
          content?: Json
          created_at?: string | null
          id?: string
          page_id?: string
          parent_block_id?: string | null
          position?: number | null
          properties?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_blocks_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "process_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_blocks_parent_block_id_fkey"
            columns: ["parent_block_id"]
            isOneToOne: false
            referencedRelation: "process_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      process_comments: {
        Row: {
          block_id: string
          content: string
          created_at: string | null
          id: string
          is_resolved: boolean | null
          page_id: string
          parent_comment_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          block_id: string
          content: string
          created_at?: string | null
          id?: string
          is_resolved?: boolean | null
          page_id: string
          parent_comment_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          block_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_resolved?: boolean | null
          page_id?: string
          parent_comment_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_comments_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "process_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_comments_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "process_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "process_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      process_page_versions: {
        Row: {
          blocks_snapshot: Json
          created_at: string | null
          id: string
          page_id: string
          title: string
          user_id: string
        }
        Insert: {
          blocks_snapshot?: Json
          created_at?: string | null
          id?: string
          page_id: string
          title: string
          user_id: string
        }
        Update: {
          blocks_snapshot?: Json
          created_at?: string | null
          id?: string
          page_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_page_versions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "process_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      process_pages: {
        Row: {
          company_id: string
          cover_url: string | null
          created_at: string | null
          created_by: string | null
          icon: string | null
          id: string
          is_favorite: boolean | null
          is_template: boolean | null
          page_type: string
          parent_id: string | null
          position: number | null
          properties: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          cover_url?: string | null
          created_at?: string | null
          created_by?: string | null
          icon?: string | null
          id?: string
          is_favorite?: boolean | null
          is_template?: boolean | null
          page_type?: string
          parent_id?: string | null
          position?: number | null
          properties?: Json | null
          title?: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          cover_url?: string | null
          created_at?: string | null
          created_by?: string | null
          icon?: string | null
          id?: string
          is_favorite?: boolean | null
          is_template?: boolean | null
          page_type?: string
          parent_id?: string | null
          position?: number | null
          properties?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_pages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_pages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "process_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      processes_feedback: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          feedback_type: string
          id: string
          target_id: string | null
          target_type: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          feedback_type: string
          id?: string
          target_id?: string | null
          target_type: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          feedback_type?: string
          id?: string
          target_id?: string | null
          target_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processes_feedback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      processes_playbooks: {
        Row: {
          category: string | null
          company_id: string
          content: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          owner_id: string
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          company_id: string
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          owner_id: string
          title: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          company_id?: string
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          owner_id?: string
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processes_playbooks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      processes_reports: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          improvement_suggestions: Json | null
          insights: Json | null
          kpis: Json | null
          owner_id: string
          period_end: string | null
          period_start: string | null
          report_type: string | null
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          improvement_suggestions?: Json | null
          insights?: Json | null
          kpis?: Json | null
          owner_id: string
          period_end?: string | null
          period_start?: string | null
          report_type?: string | null
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          improvement_suggestions?: Json | null
          insights?: Json | null
          kpis?: Json | null
          owner_id?: string
          period_end?: string | null
          period_start?: string | null
          report_type?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "processes_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      processes_routines: {
        Row: {
          channels: Json | null
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          kpis_expected: Json | null
          name: string
          owner_id: string
          steps: Json | null
          type: string
          updated_at: string | null
        }
        Insert: {
          channels?: Json | null
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          kpis_expected?: Json | null
          name: string
          owner_id: string
          steps?: Json | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          channels?: Json | null
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          kpis_expected?: Json | null
          name?: string
          owner_id?: string
          steps?: Json | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processes_routines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      processes_stages: {
        Row: {
          checklist: Json | null
          company_id: string
          created_at: string | null
          dos_and_donts: Json | null
          id: string
          kpis_expected: Json | null
          max_time_hours: number | null
          objectives: string | null
          owner_id: string
          scripts: Json | null
          stage_name: string
          stage_order: number | null
          updated_at: string | null
        }
        Insert: {
          checklist?: Json | null
          company_id: string
          created_at?: string | null
          dos_and_donts?: Json | null
          id?: string
          kpis_expected?: Json | null
          max_time_hours?: number | null
          objectives?: string | null
          owner_id: string
          scripts?: Json | null
          stage_name: string
          stage_order?: number | null
          updated_at?: string | null
        }
        Update: {
          checklist?: Json | null
          company_id?: string
          created_at?: string | null
          dos_and_donts?: Json | null
          id?: string
          kpis_expected?: Json | null
          max_time_hours?: number | null
          objectives?: string | null
          owner_id?: string
          scripts?: Json | null
          stage_name?: string
          stage_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processes_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos_servicos: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          company_id: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          preco_sugerido: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          company_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          preco_sugerido?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          company_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          preco_sugerido?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_servicos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profissionais: {
        Row: {
          company_id: string | null
          created_at: string | null
          email: string
          especialidade: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          email: string
          especialidade?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          email?: string
          especialidade?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profissionais_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_message_categories: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quick_message_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_messages: {
        Row: {
          category_id: string | null
          company_id: string
          content: string
          created_at: string | null
          id: string
          media_url: string | null
          message_type: string | null
          owner_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          company_id: string
          content: string
          created_at?: string | null
          id?: string
          media_url?: string | null
          message_type?: string | null
          owner_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          company_id?: string
          content?: string
          created_at?: string | null
          id?: string
          media_url?: string | null
          message_type?: string | null
          owner_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quick_messages_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "quick_message_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          permission_id: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          permission_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          permission_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_cadence_actions: {
        Row: {
          action_description: string | null
          cadence_progress_id: string
          channel: string
          company_id: string
          created_at: string
          error_message: string | null
          id: string
          lead_id: string
          message_content: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          step_number: number
          updated_at: string
        }
        Insert: {
          action_description?: string | null
          cadence_progress_id: string
          channel: string
          company_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id: string
          message_content?: string | null
          scheduled_at: string
          sent_at?: string | null
          status?: string
          step_number: number
          updated_at?: string
        }
        Update: {
          action_description?: string | null
          cadence_progress_id?: string
          channel?: string
          company_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string
          message_content?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          step_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_cadence_actions_cadence_progress_id_fkey"
            columns: ["cadence_progress_id"]
            isOneToOne: false
            referencedRelation: "lead_cadence_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_cadence_actions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_cadence_actions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_whatsapp_messages: {
        Row: {
          company_id: string
          contact_name: string | null
          conversation_id: string
          created_at: string
          error_message: string | null
          id: string
          message_content: string
          owner_id: string
          phone_number: string
          scheduled_datetime: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          contact_name?: string | null
          conversation_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_content: string
          owner_id: string
          phone_number: string
          scheduled_datetime: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          contact_name?: string | null
          conversation_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_content?: string
          owner_id?: string
          phone_number?: string
          scheduled_datetime?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_queue_members: {
        Row: {
          created_at: string | null
          id: string
          queue_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          queue_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          queue_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_queue_members_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "support_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      support_queues: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          priority: number | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      task_boards: {
        Row: {
          atualizado_em: string | null
          company_id: string | null
          criado_em: string | null
          descricao: string | null
          id: string
          nome: string
          owner_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          company_id?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome: string
          owner_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          company_id?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_boards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_boards_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_columns: {
        Row: {
          atualizado_em: string | null
          board_id: string | null
          company_id: string | null
          cor: string | null
          criado_em: string | null
          id: string
          nome: string
          posicao: number | null
        }
        Insert: {
          atualizado_em?: string | null
          board_id?: string | null
          company_id?: string | null
          cor?: string | null
          criado_em?: string | null
          id?: string
          nome: string
          posicao?: number | null
        }
        Update: {
          atualizado_em?: string | null
          board_id?: string | null
          company_id?: string | null
          cor?: string | null
          criado_em?: string | null
          id?: string
          nome?: string
          posicao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "task_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "task_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_columns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          attachments: Json | null
          board_id: string | null
          checklist: Json | null
          column_id: string | null
          comments: Json | null
          company_id: string | null
          compromisso_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          owner_id: string
          priority: string
          professional_id: string | null
          responsaveis: string[] | null
          start_date: string | null
          status: string
          tags: string[] | null
          tempo_gasto: number | null
          time_tracking_iniciado: string | null
          time_tracking_pausado: boolean | null
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          attachments?: Json | null
          board_id?: string | null
          checklist?: Json | null
          column_id?: string | null
          comments?: Json | null
          company_id?: string | null
          compromisso_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          owner_id: string
          priority?: string
          professional_id?: string | null
          responsaveis?: string[] | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          tempo_gasto?: number | null
          time_tracking_iniciado?: string | null
          time_tracking_pausado?: boolean | null
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          attachments?: Json | null
          board_id?: string | null
          checklist?: Json | null
          column_id?: string | null
          comments?: Json | null
          company_id?: string | null
          compromisso_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          owner_id?: string
          priority?: string
          professional_id?: string | null
          responsaveis?: string[] | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          tempo_gasto?: number | null
          time_tracking_iniciado?: string | null
          time_tracking_pausado?: boolean | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "task_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "task_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_compromisso_id_fkey"
            columns: ["compromisso_id"]
            isOneToOne: false
            referencedRelation: "compromissos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_integrations: {
        Row: {
          ad_account_id: string | null
          company_id: string
          created_at: string | null
          gmail_access_token: string | null
          gmail_email: string | null
          gmail_refresh_token: string | null
          gmail_status: string | null
          gmail_token_expires_at: string | null
          granted_permissions: string[] | null
          id: string
          instagram_ig_id: string | null
          instagram_status: string | null
          instagram_username: string | null
          lead_form_ids: string[] | null
          marketing_status: string | null
          messenger_page_access_token: string | null
          messenger_page_id: string | null
          messenger_page_name: string | null
          messenger_status: string | null
          meta_access_token: string | null
          meta_app_scoped_user_id: string | null
          meta_refresh_token: string | null
          meta_token_expires_at: string | null
          provider_priority: string | null
          updated_at: string | null
          waba_id: string | null
          whatsapp_phone_number: string | null
          whatsapp_phone_number_id: string | null
          whatsapp_status: string | null
        }
        Insert: {
          ad_account_id?: string | null
          company_id: string
          created_at?: string | null
          gmail_access_token?: string | null
          gmail_email?: string | null
          gmail_refresh_token?: string | null
          gmail_status?: string | null
          gmail_token_expires_at?: string | null
          granted_permissions?: string[] | null
          id?: string
          instagram_ig_id?: string | null
          instagram_status?: string | null
          instagram_username?: string | null
          lead_form_ids?: string[] | null
          marketing_status?: string | null
          messenger_page_access_token?: string | null
          messenger_page_id?: string | null
          messenger_page_name?: string | null
          messenger_status?: string | null
          meta_access_token?: string | null
          meta_app_scoped_user_id?: string | null
          meta_refresh_token?: string | null
          meta_token_expires_at?: string | null
          provider_priority?: string | null
          updated_at?: string | null
          waba_id?: string | null
          whatsapp_phone_number?: string | null
          whatsapp_phone_number_id?: string | null
          whatsapp_status?: string | null
        }
        Update: {
          ad_account_id?: string | null
          company_id?: string
          created_at?: string | null
          gmail_access_token?: string | null
          gmail_email?: string | null
          gmail_refresh_token?: string | null
          gmail_status?: string | null
          gmail_token_expires_at?: string | null
          granted_permissions?: string[] | null
          id?: string
          instagram_ig_id?: string | null
          instagram_status?: string | null
          instagram_username?: string | null
          lead_form_ids?: string[] | null
          marketing_status?: string | null
          messenger_page_access_token?: string | null
          messenger_page_id?: string | null
          messenger_page_name?: string | null
          messenger_status?: string | null
          meta_access_token?: string | null
          meta_app_scoped_user_id?: string | null
          meta_refresh_token?: string | null
          meta_token_expires_at?: string | null
          provider_priority?: string | null
          updated_at?: string | null
          waba_id?: string | null
          whatsapp_phone_number?: string | null
          whatsapp_phone_number_id?: string | null
          whatsapp_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          company_id: string
          created_at: string | null
          granted: boolean | null
          id: string
          permission_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          granted?: boolean | null
          id?: string
          permission_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          granted?: boolean | null
          id?: string
          permission_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaigns_analytics: {
        Row: {
          campaign_id: string | null
          campaign_name: string
          company_id: string | null
          created_at: string | null
          estimated_cost: number | null
          id: string
          period_end: string | null
          period_start: string | null
          provider: string | null
          template_id: string | null
          total_delivered: number | null
          total_failed: number | null
          total_read: number | null
          total_replied: number | null
          total_sent: number | null
          updated_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          campaign_name: string
          company_id?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          provider?: string | null
          template_id?: string | null
          total_delivered?: number | null
          total_failed?: number | null
          total_read?: number | null
          total_replied?: number | null
          total_sent?: number | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          campaign_name?: string
          company_id?: string | null
          created_at?: string | null
          estimated_cost?: number | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          provider?: string | null
          template_id?: string | null
          total_delivered?: number | null
          total_failed?: number | null
          total_read?: number | null
          total_replied?: number | null
          total_sent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaigns_analytics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaigns_analytics_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          api_provider: string | null
          company_id: string
          created_at: string | null
          evolution_api_key: string | null
          evolution_api_url: string | null
          id: string
          instagram_access_token: string | null
          instagram_account_id: string | null
          instagram_username: string | null
          instance_name: string
          last_connected_at: string | null
          meta_access_token: string | null
          meta_business_account_id: string | null
          meta_phone_number_id: string | null
          meta_token_expires_at: string | null
          meta_webhook_verify_token: string | null
          qr_code: string | null
          qr_code_expires_at: string | null
          status: string | null
          updated_at: string | null
          whatsapp_number: string | null
        }
        Insert: {
          api_provider?: string | null
          company_id: string
          created_at?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          id?: string
          instagram_access_token?: string | null
          instagram_account_id?: string | null
          instagram_username?: string | null
          instance_name: string
          last_connected_at?: string | null
          meta_access_token?: string | null
          meta_business_account_id?: string | null
          meta_phone_number_id?: string | null
          meta_token_expires_at?: string | null
          meta_webhook_verify_token?: string | null
          qr_code?: string | null
          qr_code_expires_at?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          api_provider?: string | null
          company_id?: string
          created_at?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          id?: string
          instagram_access_token?: string | null
          instagram_account_id?: string | null
          instagram_username?: string | null
          instance_name?: string
          last_connected_at?: string | null
          meta_access_token?: string | null
          meta_business_account_id?: string | null
          meta_phone_number_id?: string | null
          meta_token_expires_at?: string | null
          meta_webhook_verify_token?: string | null
          qr_code?: string | null
          qr_code_expires_at?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_logs: {
        Row: {
          campaign_id: string | null
          campaign_name: string | null
          company_id: string | null
          conversation_id: string | null
          cost_category: string | null
          cost_estimate: number | null
          created_at: string | null
          delivered_at: string | null
          direction: string | null
          error_code: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          lead_id: string | null
          message_id_evolution: string | null
          message_id_meta: string | null
          message_type: string | null
          phone_number: string | null
          provider: string | null
          read_at: string | null
          sent_at: string | null
          status: string | null
          template_id: string | null
          template_name: string | null
        }
        Insert: {
          campaign_id?: string | null
          campaign_name?: string | null
          company_id?: string | null
          conversation_id?: string | null
          cost_category?: string | null
          cost_estimate?: number | null
          created_at?: string | null
          delivered_at?: string | null
          direction?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          lead_id?: string | null
          message_id_evolution?: string | null
          message_id_meta?: string | null
          message_type?: string | null
          phone_number?: string | null
          provider?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          template_name?: string | null
        }
        Update: {
          campaign_id?: string | null
          campaign_name?: string | null
          company_id?: string | null
          conversation_id?: string | null
          cost_category?: string | null
          cost_estimate?: number | null
          created_at?: string | null
          delivered_at?: string | null
          direction?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          lead_id?: string | null
          message_id_evolution?: string | null
          message_id_meta?: string | null
          message_type?: string | null
          phone_number?: string | null
          provider?: string | null
          read_at?: string | null
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_pricing: {
        Row: {
          category: string
          country_code: string
          created_at: string | null
          currency: string | null
          effective_from: string | null
          id: string
          price_per_message: number
        }
        Insert: {
          category: string
          country_code: string
          created_at?: string | null
          currency?: string | null
          effective_from?: string | null
          id?: string
          price_per_message: number
        }
        Update: {
          category?: string
          country_code?: string
          created_at?: string | null
          currency?: string | null
          effective_from?: string | null
          id?: string
          price_per_message?: number
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          category: string | null
          company_id: string | null
          components: Json | null
          created_at: string | null
          id: string
          language: string | null
          meta_template_id: string | null
          name: string
          quality_score: string | null
          status: string | null
          synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          components?: Json | null
          created_at?: string | null
          id?: string
          language?: string | null
          meta_template_id?: string | null
          name: string
          quality_score?: string | null
          status?: string | null
          synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          company_id?: string | null
          components?: Json | null
          created_at?: string | null
          id?: string
          language?: string | null
          meta_template_id?: string | null
          name?: string
          quality_score?: string | null
          status?: string | null
          synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_user_can_access_funil: {
        Args: { p_funil_id: string }
        Returns: undefined
      }
      elevate_self_to_super_admin: { Args: never; Returns: Json }
      formatar_telefone: { Args: { telefone: string }; Returns: string }
      get_my_company: {
        Args: never
        Returns: {
          id: string
          is_master_account: boolean
          max_leads: number
          max_users: number
          name: string
          parent_company_id: string
          plan: string
          status: string
        }[]
      }
      get_my_company_id: { Args: never; Returns: string }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_my_user_role: {
        Args: never
        Returns: {
          company_id: string
          company_name: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_user_company_ids: {
        Args: never
        Returns: {
          company_id: string
        }[]
      }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      reorder_etapas: {
        Args: { p_funil_id: string; p_order: string[] }
        Returns: undefined
      }
      update_etapa: {
        Args: {
          p_cor: string
          p_etapa_id: string
          p_nome: string
          p_posicao: number
        }
        Returns: undefined
      }
      update_funil_nome: {
        Args: { p_funil_id: string; p_nome: string }
        Returns: undefined
      }
      user_belongs_to_company: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_permission: {
        Args: { _permission_name: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "company_admin"
        | "gestor"
        | "vendedor"
        | "suporte"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "company_admin",
        "gestor",
        "vendedor",
        "suporte",
      ],
    },
  },
} as const
