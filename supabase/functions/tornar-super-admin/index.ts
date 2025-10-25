import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Pegar o usuário da requisição
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Sem autorização');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Usuário não encontrado');
    }

    console.log('🔐 [SUPER ADMIN] Atualizando role para:', user.id);

    // Buscar role atual
    const { data: currentRole } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!currentRole) {
      throw new Error('Role não encontrada para este usuário');
    }

    // Atualizar para super_admin
    const { error: updateError } = await supabase
      .from('user_roles')
      .update({ role: 'super_admin' })
      .eq('user_id', user.id)
      .eq('company_id', currentRole.company_id);

    if (updateError) {
      console.error('❌ [SUPER ADMIN] Erro ao atualizar:', updateError);
      throw updateError;
    }

    console.log('✅ [SUPER ADMIN] Role atualizada com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        mensagem: 'Você agora é Super Admin! Recarregue a página para ver as novas permissões.',
        role_anterior: currentRole.role,
        role_nova: 'super_admin'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ [SUPER ADMIN] Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
