import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RedefinirSenhaRequest {
  userId?: string;
  companyId?: string;
  novaSenha: string;
  notificar?: boolean;
  email?: string;
  telefone?: string;
  nome?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, companyId, novaSenha, notificar, email, telefone, nome }: RedefinirSenhaRequest = await req.json();

    console.log('🔐 [REDEFINIR SENHA] Iniciando. userId:', userId, 'companyId:', companyId);

    if (!novaSenha || novaSenha.length < 6) {
      return new Response(JSON.stringify({ success: false, error: 'Senha deve ter no mínimo 6 caracteres' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Resolver userId: se não fornecido, buscar pelo companyId
    let resolvedUserId = userId;

    if (!resolvedUserId && companyId) {
      console.log('🔍 [REDEFINIR SENHA] Buscando admin da empresa:', companyId);
      const { data: roles, error: rolesErr } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, role')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true })
        .limit(1);

      if (rolesErr) {
        console.error('❌ [REDEFINIR SENHA] Erro ao buscar roles:', rolesErr);
        return new Response(JSON.stringify({ success: false, error: 'Erro ao buscar usuário da empresa' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (roles && roles.length > 0) {
        resolvedUserId = roles[0].user_id;
        console.log('✅ [REDEFINIR SENHA] Usuário encontrado:', resolvedUserId, 'role:', roles[0].role);
      }
    }

    if (!resolvedUserId) {
      console.error('❌ [REDEFINIR SENHA] Nenhum userId encontrado');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Usuário não encontrado para esta empresa. Verifique se a subconta possui um usuário administrador.' 
      }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Atualizar senha do usuário
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      resolvedUserId,
      { password: novaSenha }
    );

    if (updateError) {
      console.error('❌ [REDEFINIR SENHA] Erro ao atualizar:', updateError);
      throw updateError;
    }

    console.log('✅ [REDEFINIR SENHA] Senha atualizada com sucesso para:', resolvedUserId);

    // Enviar notificação se solicitado
    if (notificar && (email || telefone)) {
      const mensagem = `
🔐 *Senha Redefinida - CRM CEUSIA*

Olá ${nome || 'usuário'}!

Sua senha foi redefinida com sucesso pelo administrador.

*Nova Senha:* ${novaSenha}

⚠️ *IMPORTANTE:* 
• Guarde esta senha em local seguro
• Recomendamos alterar sua senha após o login
• Nunca compartilhe suas credenciais

Para acessar o sistema, use seu e-mail e a nova senha.

Dúvidas? Entre em contato com o suporte.
      `.trim();

      if (telefone) {
        try {
          const telefoneFormatado = telefone.replace(/\D/g, '');
          const numero = telefoneFormatado.startsWith('55') 
            ? telefoneFormatado 
            : `55${telefoneFormatado}`;

          const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
          const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE');
          const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

          await fetch(
            `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY || '',
              },
              body: JSON.stringify({
                number: numero,
                text: mensagem,
              }),
            }
          );
          console.log('✅ [REDEFINIR SENHA] Notificação WhatsApp enviada');
        } catch (error) {
          console.error('❌ [REDEFINIR SENHA] Erro ao enviar WhatsApp:', error);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mensagem: 'Senha redefinida com sucesso',
        userId: resolvedUserId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [REDEFINIR SENHA] Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
