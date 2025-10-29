import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const createBoardSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo'),
  descricao: z.string().max(500).optional()
});

const createColumnSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo'),
  board_id: z.string().uuid('ID de board inválido'),
  posicao: z.number().int().min(0).optional(),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida').optional()
});

const createTaskSchema = z.object({
  title: z.string().trim().min(2, 'Título muito curto').max(200, 'Título muito longo'),
  description: z.string().max(2000, 'Descrição muito longa').optional(),
  assignee_id: z.string().uuid('ID de responsável inválido').optional(),
  lead_id: z.string().uuid('ID de lead inválido').optional(),
  column_id: z.string().uuid('ID de coluna inválido').optional(),
  board_id: z.string().uuid('ID de board inválido').optional(),
  due_date: z.string().datetime().optional(),
  priority: z.enum(['baixa', 'media', 'alta', 'urgente']).optional(),
  tags: z.array(z.string()).optional(),
  checklist: z.array(z.object({ id: z.string().optional(), text: z.string(), done: z.boolean() })).optional(),
  comments: z.array(z.object({ id: z.string().optional(), text: z.string(), author_id: z.string().uuid().optional(), created_at: z.string().optional() })).optional(),
  attachments: z.array(z.object({ name: z.string(), url: z.string().url() })).optional(),
  responsaveis: z.array(z.string().uuid()).optional()
});

const moveTaskSchema = z.object({
  task_id: z.string().uuid('ID de tarefa inválido'),
  nova_coluna_id: z.string().uuid('ID de coluna inválido')
});

const deleteTaskSchema = z.object({
  task_id: z.string().uuid('ID de tarefa inválido')
});

const editTaskSchema = z.object({
  task_id: z.string().uuid('ID de tarefa inválido'),
  title: z.string().trim().min(2, 'Título muito curto').max(200, 'Título muito longo').optional(),
  description: z.string().max(2000, 'Descrição muito longa').optional(),
  priority: z.enum(['baixa', 'media', 'alta', 'urgente']).optional(),
  due_date: z.string().datetime().optional(),
  assignee_id: z.string().uuid('ID de responsável inválido').optional(),
  lead_id: z.string().uuid('ID de lead inválido').optional(),
  tags: z.array(z.string()).optional(),
  checklist: z.array(z.object({ id: z.string().optional(), text: z.string(), done: z.boolean() })).optional(),
  comments: z.array(z.object({ id: z.string().optional(), text: z.string(), author_id: z.string().uuid().optional(), created_at: z.string().optional() })).optional(),
  attachments: z.array(z.object({ name: z.string(), url: z.string().url() })).optional(),
  responsaveis: z.array(z.string().uuid()).optional()
});

const editBoardSchema = z.object({
  board_id: z.string().uuid('ID de board inválido'),
  nome: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo')
});

const deleteBoardSchema = z.object({
  board_id: z.string().uuid('ID de board inválido')
});

const editColumnSchema = z.object({
  column_id: z.string().uuid('ID de coluna inválido'),
  nome: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo').optional(),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida').optional()
});

const deleteColumnSchema = z.object({
  column_id: z.string().uuid('ID de coluna inválido')
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's company_id
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!userRole?.company_id) {
      return new Response(
        JSON.stringify({ error: "Você não tem permissão para esta ação", code: "FORBIDDEN" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companyId = userRole.company_id;
    const { action, data } = await req.json();
    console.log(`Action: ${action}`);

    switch (action) {
      case "criar_board": {
        const validatedData = createBoardSchema.parse(data);
        const { data: board, error } = await supabase
          .from("task_boards")
          .insert([{ nome: validatedData.nome, descricao: validatedData.descricao, owner_id: user.id, company_id: companyId }])
          .select()
          .single();

        if (error) {
          console.error("Error creating board:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao criar board", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true, data: board }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "criar_coluna": {
        const validatedData = createColumnSchema.parse(data);
        const { data: column, error } = await supabase
          .from("task_columns")
          .insert([{ 
            nome: validatedData.nome, 
            board_id: validatedData.board_id, 
            posicao: validatedData.posicao || 0, 
            cor: validatedData.cor || '#6b7280', 
            company_id: companyId 
          }])
          .select()
          .single();

        if (error) {
          console.error("Error creating column:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao criar coluna", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true, data: column }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "criar_tarefa": {
        const validatedData = createTaskSchema.parse(data);
        const { data: task, error } = await supabase
          .from("tasks")
          .insert([{
            title: validatedData.title,
            description: validatedData.description,
            assignee_id: validatedData.assignee_id,
            lead_id: validatedData.lead_id,
            column_id: validatedData.column_id,
            board_id: validatedData.board_id,
            due_date: validatedData.due_date,
            priority: validatedData.priority || 'media',
            status: 'pendente',
            owner_id: user.id,
            company_id: companyId,
            tags: validatedData.tags || [],
            checklist: validatedData.checklist || [],
            comments: validatedData.comments || [],
            attachments: validatedData.attachments || [],
            responsaveis: validatedData.responsaveis || []
          }])
          .select()
          .single();

        if (error) {
          console.error("Error creating task:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao criar tarefa", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true, data: task }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "mover_tarefa": {
        const validatedData = moveTaskSchema.parse(data);
        const { error } = await supabase
          .from("tasks")
          .update({ column_id: validatedData.nova_coluna_id })
          .eq("id", validatedData.task_id);

        if (error) {
          console.error("Error moving task:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao mover tarefa", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "deletar_tarefa": {
        const validatedData = deleteTaskSchema.parse(data);
        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", validatedData.task_id);

        if (error) {
          console.error("Error deleting task:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao deletar tarefa", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "editar_tarefa": {
        const validatedData = editTaskSchema.parse(data);
        const { data: task, error } = await supabase
          .from("tasks")
          .update({
            title: validatedData.title,
            description: validatedData.description,
            priority: validatedData.priority,
            due_date: validatedData.due_date,
            assignee_id: validatedData.assignee_id,
            lead_id: validatedData.lead_id,
            tags: validatedData.tags,
            checklist: validatedData.checklist,
            comments: validatedData.comments,
            attachments: validatedData.attachments,
            responsaveis: validatedData.responsaveis,
          })
          .eq("id", validatedData.task_id)
          .select()
          .single();

        if (error) {
          console.error("Error updating task:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao atualizar tarefa", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true, data: task }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "editar_board": {
        const validatedData = editBoardSchema.parse(data);
        const { data: board, error } = await supabase
          .from("task_boards")
          .update({ nome: validatedData.nome })
          .eq("id", validatedData.board_id)
          .select()
          .single();

        if (error) {
          console.error("Error updating board:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao atualizar board", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true, data: board }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "deletar_board": {
        const validatedData = deleteBoardSchema.parse(data);
        
        // Primeiro deletar todas as colunas do board
        await supabase.from("task_columns").delete().eq("board_id", validatedData.board_id);
        
        // Depois deletar o board
        const { error } = await supabase
          .from("task_boards")
          .delete()
          .eq("id", validatedData.board_id);

        if (error) {
          console.error("Error deleting board:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao deletar board", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "editar_coluna": {
        const validatedData = editColumnSchema.parse(data);
        const { data: column, error } = await supabase
          .from("task_columns")
          .update({ nome: validatedData.nome, cor: validatedData.cor })
          .eq("id", validatedData.column_id)
          .select()
          .single();

        if (error) {
          console.error("Error updating column:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao atualizar coluna", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true, data: column }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "deletar_coluna": {
        const validatedData = deleteColumnSchema.parse(data);
        const { error } = await supabase
          .from("task_columns")
          .delete()
          .eq("id", validatedData.column_id);

        if (error) {
          console.error("Error deleting column:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao deletar coluna", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: "Ação inválida", code: "INVALID_ACTION" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error("Error in api-tarefas:", error);
    
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Dados inválidos fornecidos', code: 'VALIDATION_ERROR', details: error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar requisição", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});