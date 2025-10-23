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
          created_at: string | null
          disponibilidade: Json | null
          id: string
          nome: string
          owner_id: string
          responsavel_id: string | null
          status: string | null
          tempo_medio_servico: number | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          capacidade_simultanea?: number | null
          created_at?: string | null
          disponibilidade?: Json | null
          id?: string
          nome: string
          owner_id: string
          responsavel_id?: string | null
          status?: string | null
          tempo_medio_servico?: number | null
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          capacidade_simultanea?: number | null
          created_at?: string | null
          disponibilidade?: Json | null
          id?: string
          nome?: string
          owner_id?: string
          responsavel_id?: string | null
          status?: string | null
          tempo_medio_servico?: number | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      compromissos: {
        Row: {
          agenda_id: string | null
          created_at: string | null
          custo_estimado: number | null
          data_hora_fim: string
          data_hora_inicio: string
          id: string
          lead_id: string | null
          lembrete_enviado: boolean | null
          observacoes: string | null
          owner_id: string
          status: string | null
          tipo_servico: string
          updated_at: string | null
          usuario_responsavel_id: string
        }
        Insert: {
          agenda_id?: string | null
          created_at?: string | null
          custo_estimado?: number | null
          data_hora_fim: string
          data_hora_inicio: string
          id?: string
          lead_id?: string | null
          lembrete_enviado?: boolean | null
          observacoes?: string | null
          owner_id: string
          status?: string | null
          tipo_servico: string
          updated_at?: string | null
          usuario_responsavel_id: string
        }
        Update: {
          agenda_id?: string | null
          created_at?: string | null
          custo_estimado?: number | null
          data_hora_fim?: string
          data_hora_inicio?: string
          id?: string
          lead_id?: string | null
          lembrete_enviado?: boolean | null
          observacoes?: string | null
          owner_id?: string
          status?: string | null
          tipo_servico?: string
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
            foreignKeyName: "compromissos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      conversas: {
        Row: {
          arquivo_nome: string | null
          created_at: string | null
          id: string
          mensagem: string
          midia_url: string | null
          nome_contato: string | null
          numero: string
          origem: string
          owner_id: string | null
          status: string
          tipo_mensagem: string | null
          updated_at: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          created_at?: string | null
          id?: string
          mensagem: string
          midia_url?: string | null
          nome_contato?: string | null
          numero: string
          origem?: string
          owner_id?: string | null
          status?: string
          tipo_mensagem?: string | null
          updated_at?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          created_at?: string | null
          id?: string
          mensagem?: string
          midia_url?: string | null
          nome_contato?: string | null
          numero?: string
          origem?: string
          owner_id?: string | null
          status?: string
          tipo_mensagem?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      etapas: {
        Row: {
          atualizado_em: string | null
          cor: string | null
          criado_em: string | null
          funil_id: string | null
          id: string
          nome: string
          posicao: number | null
        }
        Insert: {
          atualizado_em?: string | null
          cor?: string | null
          criado_em?: string | null
          funil_id?: string | null
          id?: string
          nome: string
          posicao?: number | null
        }
        Update: {
          atualizado_em?: string | null
          cor?: string | null
          criado_em?: string | null
          funil_id?: string | null
          id?: string
          nome?: string
          posicao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "etapas_funil_id_fkey"
            columns: ["funil_id"]
            isOneToOne: false
            referencedRelation: "funis"
            referencedColumns: ["id"]
          },
        ]
      }
      funis: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          descricao: string | null
          id: string
          nome: string
          owner_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome: string
          owner_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funis_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          company: string | null
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
          source: string | null
          stage: string | null
          status: string | null
          telefone: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          company?: string | null
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
          source?: string | null
          stage?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          company?: string | null
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
          source?: string | null
          stage?: string | null
          status?: string | null
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
          canal: string
          compromisso_id: string
          created_at: string | null
          data_envio: string | null
          horas_antecedencia: number
          id: string
          mensagem: string | null
          status_envio: string | null
        }
        Insert: {
          canal: string
          compromisso_id: string
          created_at?: string | null
          data_envio?: string | null
          horas_antecedencia?: number
          id?: string
          mensagem?: string | null
          status_envio?: string | null
        }
        Update: {
          canal?: string
          compromisso_id?: string
          created_at?: string | null
          data_envio?: string | null
          horas_antecedencia?: number
          id?: string
          mensagem?: string | null
          status_envio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lembretes_compromisso_id_fkey"
            columns: ["compromisso_id"]
            isOneToOne: false
            referencedRelation: "compromissos"
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
      task_boards: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          descricao: string | null
          id: string
          nome: string
          owner_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome: string
          owner_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          owner_id?: string | null
        }
        Relationships: [
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
          cor: string | null
          criado_em: string | null
          id: string
          nome: string
          posicao: number | null
        }
        Insert: {
          atualizado_em?: string | null
          board_id?: string | null
          cor?: string | null
          criado_em?: string | null
          id?: string
          nome: string
          posicao?: number | null
        }
        Update: {
          atualizado_em?: string | null
          board_id?: string | null
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
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          board_id: string | null
          column_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          owner_id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          board_id?: string | null
          column_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          owner_id: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          board_id?: string | null
          column_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          owner_id?: string
          priority?: string
          status?: string
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
