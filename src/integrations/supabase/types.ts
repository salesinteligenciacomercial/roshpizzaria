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
      companies: {
        Row: {
          allow_ai_features: boolean | null
          allow_group_messages: boolean | null
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
          allow_group_messages?: boolean | null
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
          allow_group_messages?: boolean | null
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
          arquivo_nome: string | null
          assigned_user_id: string | null
          campanha_id: string | null
          campanha_nome: string | null
          company_id: string | null
          created_at: string | null
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
          arquivo_nome?: string | null
          assigned_user_id?: string | null
          campanha_id?: string | null
          campanha_nome?: string | null
          company_id?: string | null
          created_at?: string | null
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
          arquivo_nome?: string | null
          assigned_user_id?: string | null
          campanha_id?: string | null
          campanha_nome?: string | null
          company_id?: string | null
          created_at?: string | null
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
      leads: {
        Row: {
          company: string | null
          company_id: string | null
          cpf: string | null
          created_at: string | null
          email: string | null
          etapa_id: string | null
          funil_id: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
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
          value: number | null
        }
        Insert: {
          company?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          etapa_id?: string | null
          funil_id?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
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
          value?: number | null
        }
        Update: {
          company?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          etapa_id?: string | null
          funil_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
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
          value?: number | null
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
      whatsapp_connections: {
        Row: {
          api_provider: string | null
          company_id: string
          created_at: string | null
          evolution_api_key: string | null
          evolution_api_url: string | null
          id: string
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
