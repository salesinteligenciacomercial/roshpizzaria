import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function diffHours(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60));
}

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const evolutionApi = Deno.env.get('EVOLUTION_API');
    const evolutionKey = Deno.env.get('EVOLUTION_KEY');

    const supabase = createClient(supabaseUrl, supabaseService);

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, due_date, notificacao_enviada, responsaveis, assignee_id')
      .not('due_date', 'is', null);

    const now = new Date();
    for (const t of tasks || []) {
      if (!t.due_date || t.notificacao_enviada) continue;
      const horas = diffHours(new Date(t.due_date), now);
      if (horas <= 24 && horas >= 0) {
        // Buscar telefones dos responsáveis (ou assignee_id)
        let ids = (t.responsaveis || []) as string[];
        if ((!ids || ids.length === 0) && t.assignee_id) {
          ids = [t.assignee_id];
        }
        if (!ids?.length || !evolutionApi || !evolutionKey) continue;
        const { data: perfis } = await supabase.from('profiles').select('id, phone').in('id', ids);
        for (const p of perfis || []) {
          if (!p.phone) continue;
          const url = `${evolutionApi.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(p.phone)}`;
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
            body: JSON.stringify({ message: `📅 Lembrete: a tarefa "${t.title}" vence em ${horas}h.` })
          });
        }
        await supabase.from('tasks').update({ notificacao_enviada: true }).eq('id', t.id);
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});


