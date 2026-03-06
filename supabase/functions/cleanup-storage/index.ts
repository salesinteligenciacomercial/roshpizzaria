import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", user.id)
      .single();

    if (!userRole || !["super_admin", "company_admin"].includes(userRole.role)) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem executar limpeza" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "analyze";
    const companyId = userRole.company_id;

    if (action === "analyze") {
      // Analyze storage usage per bucket
      const buckets = ["conversation-media", "internal-chat-media", "lead-attachments"];
      const analysis: Record<string, any> = {};

      for (const bucket of buckets) {
        const { data: files, error } = await supabase
          .from("storage.objects" as any)
          .select("id, name, created_at, metadata")
          .eq("bucket_id", bucket)
          .order("created_at", { ascending: true })
          .limit(1);

        // Use raw SQL via RPC or direct count
        // Count files per bucket using storage API
        const { data: allFiles } = await supabase.storage
          .from(bucket)
          .list("", { limit: 1 });

        analysis[bucket] = {
          bucket,
          accessible: !error,
        };
      }

      // Get total counts using service role direct query approach
      // Count conversation-media files not referenced by any conversa
      const { data: storageStats } = await supabase.rpc("get_storage_cleanup_stats", {
        p_company_id: companyId,
      }).maybeSingle();

      // Fallback: manual count approach
      let totalFiles = 0;
      let totalSizeBytes = 0;
      let orphanedFiles = 0;
      let orphanedSizeBytes = 0;

      // List all files in conversation-media in batches
      const batchSize = 1000;
      let offset = 0;
      let hasMore = true;
      const referencedNames = new Set<string>();

      // Get all media URLs from conversas for this company
      let mediaOffset = 0;
      let mediaHasMore = true;
      while (mediaHasMore) {
        const { data: conversas } = await supabase
          .from("conversas")
          .select("midia_url")
          .eq("company_id", companyId)
          .not("midia_url", "is", null)
          .range(mediaOffset, mediaOffset + 999);

        if (!conversas || conversas.length === 0) {
          mediaHasMore = false;
        } else {
          for (const c of conversas) {
            if (c.midia_url) {
              // Extract filename from URL
              const parts = c.midia_url.split("/");
              const name = parts.slice(-2).join("/"); // e.g. incoming/filename.jpg
              referencedNames.add(name);
              // Also add just the filename
              referencedNames.add(parts[parts.length - 1]);
            }
          }
          mediaOffset += conversas.length;
          if (conversas.length < 1000) mediaHasMore = false;
        }
      }

      // Now scan storage files
      const folders = ["incoming", "outgoing", "sent", ""];
      for (const folder of folders) {
        let folderOffset = 0;
        let folderHasMore = true;
        while (folderHasMore) {
          const { data: files } = await supabase.storage
            .from("conversation-media")
            .list(folder, { limit: batchSize, offset: folderOffset });

          if (!files || files.length === 0) {
            folderHasMore = false;
            break;
          }

          for (const file of files) {
            if (!file.name || file.name === ".emptyFolderPlaceholder") continue;
            const fullPath = folder ? `${folder}/${file.name}` : file.name;
            const fileSize = (file.metadata as any)?.size || 0;
            totalFiles++;
            totalSizeBytes += fileSize;

            // Check if this file is referenced
            const isReferenced = referencedNames.has(fullPath) || referencedNames.has(file.name);
            if (!isReferenced) {
              orphanedFiles++;
              orphanedSizeBytes += fileSize;
            }
          }

          folderOffset += files.length;
          if (files.length < batchSize) folderHasMore = false;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          analysis: {
            totalFiles,
            totalSizeMB: Math.round(totalSizeBytes / 1024 / 1024),
            orphanedFiles,
            orphanedSizeMB: Math.round(orphanedSizeBytes / 1024 / 1024),
            referencedFiles: totalFiles - orphanedFiles,
            referencedSizeMB: Math.round((totalSizeBytes - orphanedSizeBytes) / 1024 / 1024),
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "cleanup") {
      const maxAge = body.maxAgeDays || null; // Optional: only delete files older than X days
      const dryRun = body.dryRun || false;

      // Get all referenced media URLs
      const referencedNames = new Set<string>();
      let mediaOffset = 0;
      let mediaHasMore = true;
      while (mediaHasMore) {
        const { data: conversas } = await supabase
          .from("conversas")
          .select("midia_url")
          .eq("company_id", companyId)
          .not("midia_url", "is", null)
          .range(mediaOffset, mediaOffset + 999);

        if (!conversas || conversas.length === 0) {
          mediaHasMore = false;
        } else {
          for (const c of conversas) {
            if (c.midia_url) {
              const parts = c.midia_url.split("/");
              referencedNames.add(parts.slice(-2).join("/"));
              referencedNames.add(parts[parts.length - 1]);
            }
          }
          mediaOffset += conversas.length;
          if (conversas.length < 1000) mediaHasMore = false;
        }
      }

      // Also check internal_messages media
      const { data: internalMsgs } = await supabase
        .from("internal_messages")
        .select("media_url")
        .not("media_url", "is", null);
      
      if (internalMsgs) {
        for (const m of internalMsgs) {
          if (m.media_url) {
            const parts = m.media_url.split("/");
            referencedNames.add(parts.slice(-2).join("/"));
            referencedNames.add(parts[parts.length - 1]);
          }
        }
      }

      console.log(`📊 Total de URLs referenciadas: ${referencedNames.size}`);

      // Delete orphaned files in batches
      let deletedCount = 0;
      let deletedSizeBytes = 0;
      let errorCount = 0;
      const folders = ["incoming", "outgoing", "sent", ""];
      const deleteLimit = body.limit || 5000; // Max files to delete per run

      for (const folder of folders) {
        if (deletedCount >= deleteLimit) break;
        let folderOffset = 0;
        let folderHasMore = true;

        while (folderHasMore && deletedCount < deleteLimit) {
          const { data: files } = await supabase.storage
            .from("conversation-media")
            .list(folder, { limit: 500, offset: folderOffset });

          if (!files || files.length === 0) {
            folderHasMore = false;
            break;
          }

          const toDelete: string[] = [];
          for (const file of files) {
            if (!file.name || file.name === ".emptyFolderPlaceholder") continue;
            const fullPath = folder ? `${folder}/${file.name}` : file.name;
            const isReferenced = referencedNames.has(fullPath) || referencedNames.has(file.name);

            if (!isReferenced) {
              // Check age if maxAge specified
              if (maxAge && file.created_at) {
                const fileDate = new Date(file.created_at);
                const ageDays = (Date.now() - fileDate.getTime()) / (1000 * 60 * 60 * 24);
                if (ageDays < maxAge) continue;
              }
              toDelete.push(fullPath);
            }
          }

          if (toDelete.length > 0 && !dryRun) {
            // Delete in sub-batches of 100
            for (let i = 0; i < toDelete.length && deletedCount < deleteLimit; i += 100) {
              const batch = toDelete.slice(i, i + 100);
              const { error: deleteError } = await supabase.storage
                .from("conversation-media")
                .remove(batch);

              if (deleteError) {
                console.error(`❌ Erro ao deletar lote:`, deleteError);
                errorCount += batch.length;
              } else {
                deletedCount += batch.length;
                console.log(`🗑️ Deletados ${deletedCount} arquivos órfãos`);
              }
            }
          } else if (dryRun) {
            deletedCount += toDelete.length;
          }

          folderOffset += files.length;
          if (files.length < 500) folderHasMore = false;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          dryRun,
          deletedCount,
          errorCount,
          message: dryRun
            ? `${deletedCount} arquivos órfãos encontrados (simulação)`
            : `${deletedCount} arquivos órfãos removidos com sucesso`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida. Use "analyze" ou "cleanup"' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Erro na limpeza:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
