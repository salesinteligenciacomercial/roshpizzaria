import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, data } = await req.json();
    console.log(`Action: ${action}`, data);

    switch (action) {
      case "criar_board": {
        const { nome, descricao } = data;
        const { data: board, error } = await supabase
          .from("task_boards")
          .insert([{ nome, descricao, owner_id: user.id }])
          .select()
          .single();

        if (error) {
          console.error("Error creating board:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true, data: board }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "criar_coluna": {
        const { nome, board_id, posicao, cor } = data;
        const { data: column, error } = await supabase
          .from("task_columns")
          .insert([{ nome, board_id, posicao: posicao || 0, cor: cor || '#6b7280' }])
          .select()
          .single();

        if (error) {
          console.error("Error creating column:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true, data: column }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "criar_tarefa": {
        const { title, description, assignee_id, lead_id, column_id, board_id, due_date, priority } = data;
        const { data: task, error } = await supabase
          .from("tasks")
          .insert([{
            title,
            description,
            assignee_id,
            lead_id,
            column_id,
            board_id,
            due_date,
            priority: priority || 'media',
            status: 'pendente',
            owner_id: user.id
          }])
          .select()
          .single();

        if (error) {
          console.error("Error creating task:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true, data: task }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "mover_tarefa": {
        const { task_id, nova_coluna_id } = data;
        const { error } = await supabase
          .from("tasks")
          .update({ column_id: nova_coluna_id })
          .eq("id", task_id);

        if (error) {
          console.error("Error moving task:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "deletar_tarefa": {
        const { task_id } = data;
        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", task_id);

        if (error) {
          console.error("Error deleting task:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "editar_tarefa": {
        const { task_id, title, description, priority, due_date, assignee_id, lead_id } = data;
        const { data: task, error } = await supabase
          .from("tasks")
          .update({
            title,
            description,
            priority,
            due_date,
            assignee_id,
            lead_id,
          })
          .eq("id", task_id)
          .select()
          .single();

        if (error) {
          console.error("Error updating task:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true, data: task }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "editar_board": {
        const { board_id, nome } = data;
        const { data: board, error } = await supabase
          .from("task_boards")
          .update({ nome })
          .eq("id", board_id)
          .select()
          .single();

        if (error) {
          console.error("Error updating board:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true, data: board }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "deletar_board": {
        const { board_id } = data;
        
        // Primeiro deletar todas as colunas do board
        await supabase.from("task_columns").delete().eq("board_id", board_id);
        
        // Depois deletar o board
        const { error } = await supabase
          .from("task_boards")
          .delete()
          .eq("id", board_id);

        if (error) {
          console.error("Error deleting board:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "editar_coluna": {
        const { column_id, nome, cor } = data;
        const { data: column, error } = await supabase
          .from("task_columns")
          .update({ nome, cor })
          .eq("id", column_id)
          .select()
          .single();

        if (error) {
          console.error("Error updating column:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true, data: column }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case "deletar_coluna": {
        const { column_id } = data;
        const { error } = await supabase
          .from("task_columns")
          .delete()
          .eq("id", column_id);

        if (error) {
          console.error("Error deleting column:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Ação inválida" }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error("Error in api-tarefas:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
