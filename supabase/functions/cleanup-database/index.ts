import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");

    if (!dbUrl) {
      return new Response(JSON.stringify({ error: "SUPABASE_DB_URL não configurada" }), { status: 500, headers });
    }

    // Auth check
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers });
    }

    // Check role - only super_admin or company_admin
    const { data: roleData } = await supabase.rpc("get_my_role");
    if (!roleData || !["super_admin", "company_admin"].includes(roleData)) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403, headers });
    }

    const { action, retention_days = 7 } = await req.json();

    const client = new Client(dbUrl);
    await client.connect();

    try {
      if (action === "analyze") {
        // Measure sizes of bloat sources
        const sizeQuery = `
          SELECT 
            (SELECT pg_total_relation_size('cron.job_run_details')::bigint) as cron_size,
            (SELECT COUNT(*) FROM cron.job_run_details) as cron_count,
            (SELECT pg_total_relation_size('net._http_response')::bigint) as http_size,
            (SELECT COUNT(*) FROM net._http_response) as http_count,
            (SELECT pg_database_size(current_database())::bigint) as total_db_size,
            (SELECT SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)))::bigint 
             FROM pg_tables WHERE schemaname = 'public') as public_size
        `;
        const sizeResult = await client.queryObject(sizeQuery);
        const sizes = sizeResult.rows[0] as any;

        // Get top public tables
        const topTablesQuery = `
          SELECT tablename, 
                 pg_total_relation_size(quote_ident('public') || '.' || quote_ident(tablename))::bigint as size_bytes,
                 (SELECT n_dead_tup FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname = tablename) as dead_tuples
          FROM pg_tables 
          WHERE schemaname = 'public' 
          ORDER BY pg_total_relation_size(quote_ident('public') || '.' || quote_ident(tablename)) DESC 
          LIMIT 10
        `;
        const topTables = await client.queryObject(topTablesQuery);

        // Old records count
        const oldCronQuery = retention_days === 0
          ? `SELECT COUNT(*) as count FROM cron.job_run_details`
          : `SELECT COUNT(*) as count FROM cron.job_run_details WHERE end_time < NOW() - INTERVAL '${retention_days} days'`;
        const oldHttpQuery = retention_days === 0
          ? `SELECT COUNT(*) as count FROM net._http_response`
          : `SELECT COUNT(*) as count FROM net._http_response WHERE created < NOW() - INTERVAL '${retention_days} days'`;
        
        const oldCron = await client.queryObject(oldCronQuery);
        const oldHttp = await client.queryObject(oldHttpQuery);

        const analysis = {
          totalDbSizeMB: Math.round(Number(sizes.total_db_size) / 1024 / 1024),
          publicSchemaSizeMB: Math.round(Number(sizes.public_size) / 1024 / 1024),
          cronLogsSizeMB: Math.round(Number(sizes.cron_size) / 1024 / 1024),
          cronLogsCount: Number(sizes.cron_count),
          httpResponseSizeMB: Math.round(Number(sizes.http_size) / 1024 / 1024),
          httpResponseCount: Number(sizes.http_count),
          bloatSizeMB: Math.round((Number(sizes.cron_size) + Number(sizes.http_size)) / 1024 / 1024),
          oldCronCount: Number((oldCron.rows[0] as any).count),
          oldHttpCount: Number((oldHttp.rows[0] as any).count),
          retentionDays: retention_days,
          topTables: topTables.rows.map((r: any) => ({
            name: r.tablename,
            sizeMB: Math.round(Number(r.size_bytes) / 1024 / 1024),
            deadTuples: Number(r.dead_tuples || 0),
          })),
        };

        return new Response(JSON.stringify({ analysis }), { status: 200, headers });
      }

      if (action === "cleanup_logs") {
        let cronDel, httpDel;

        if (retention_days === 0) {
          // Limpar TUDO - todo o período
          cronDel = await client.queryObject(`DELETE FROM cron.job_run_details`);
          httpDel = await client.queryObject(`DELETE FROM net._http_response`);
        } else {
          const days = Math.max(3, Math.min(90, retention_days));
          cronDel = await client.queryObject(
            `DELETE FROM cron.job_run_details WHERE end_time < NOW() - INTERVAL '${days} days'`
          );
          httpDel = await client.queryObject(
            `DELETE FROM net._http_response WHERE created < NOW() - INTERVAL '${days} days'`
          );
        }

        const deletedCron = cronDel.rowCount ?? 0;
        const deletedHttp = httpDel.rowCount ?? 0;

        return new Response(JSON.stringify({
          success: true,
          deletedCron,
          deletedHttp,
          totalDeleted: deletedCron + deletedHttp,
        }), { status: 200, headers });
      }

      if (action === "vacuum") {
        // VACUUM ANALYZE on main public tables (cannot do VACUUM FULL without superuser)
        const tables = ["conversas", "leads", "compromissos", "automation_flow_logs", "customer_sales"];
        const results: string[] = [];
        
        for (const table of tables) {
          try {
            await client.queryArray(`VACUUM ANALYZE public.${table}`);
            results.push(`${table}: OK`);
          } catch (e) {
            results.push(`${table}: ${String(e).slice(0, 80)}`);
          }
        }

        return new Response(JSON.stringify({ success: true, results }), { status: 200, headers });
      }

      if (action === "full_maintenance") {
        // Step 1: Clean logs
        let cronDel, httpDel;
        if (retention_days === 0) {
          cronDel = await client.queryObject(`DELETE FROM cron.job_run_details`);
          httpDel = await client.queryObject(`DELETE FROM net._http_response`);
        } else {
          const days = Math.max(3, Math.min(90, retention_days));
          cronDel = await client.queryObject(
            `DELETE FROM cron.job_run_details WHERE end_time < NOW() - INTERVAL '${days} days'`
          );
          httpDel = await client.queryObject(
            `DELETE FROM net._http_response WHERE created < NOW() - INTERVAL '${days} days'`
          );
        }

        // Step 2: Vacuum main tables
        const tables = ["conversas", "leads", "compromissos"];
        for (const table of tables) {
          try {
            await client.queryArray(`VACUUM ANALYZE public.${table}`);
          } catch (_) { /* skip */ }
        }

        // Step 3: Re-measure
        const finalSize = await client.queryObject(
          `SELECT pg_database_size(current_database())::bigint as size`
        );

        return new Response(JSON.stringify({
          success: true,
          deletedCron: cronDel.rowCount ?? 0,
          deletedHttp: httpDel.rowCount ?? 0,
          finalDbSizeMB: Math.round(Number((finalSize.rows[0] as any).size) / 1024 / 1024),
        }), { status: 200, headers });
      }

      return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers });
    } finally {
      await client.end();
    }
  } catch (err) {
    console.error("cleanup-database error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers });
  }
});
