import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schemas
const createLeadSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo'),
  telefone: z.string().regex(/^[0-9]{10,15}$/, 'Telefone inválido').optional(),
  email: z.string().email('Email inválido').optional(),
  cpf: z.string().max(14).optional(),
  valor: z.number().min(0, 'Valor não pode ser negativo').optional(),
  etapa_id: z.string().uuid('ID de etapa inválido').optional(),
  funil_id: z.string().uuid('ID de funil inválido').optional(),
  company: z.string().max(100).optional(),
  source: z.string().max(100).optional(),
  notes: z.string().max(1000, 'Notas muito longas').optional()
});

const moveLeadSchema = z.object({
  lead_id: z.string().uuid('ID de lead inválido'),
  nova_etapa_id: z.string().uuid('ID de etapa inválido')
});

const createFunilSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo'),
  descricao: z.string().max(500).optional()
});

const createEtapaSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo'),
  funil_id: z.string().uuid('ID de funil inválido'),
  posicao: z.number().int().min(0).optional(),
  cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida').optional()
});

const deleteLeadSchema = z.object({
  lead_id: z.string().uuid('ID de lead inválido')
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
    const { data: userRole, error: userRoleError } = await supabase
      .from('user_roles')
      .select('company_id, role')
      .eq('user_id', user.id)
      .single();

    console.log('User role lookup:', { userId: user.id, userRole, error: userRoleError });

    if (userRoleError || !userRole?.company_id) {
      console.error('User role error:', userRoleError);
      return new Response(
        JSON.stringify({
          error: "Você não tem permissão para esta ação. Verifique se está associado a uma empresa.",
          code: "FORBIDDEN",
          details: userRoleError?.message
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companyId = userRole.company_id;
    const { action, data } = await req.json();
    console.log(`Action: ${action}`);

    switch (action) {
      case "criar_lead": {
        let validatedData;
        try {
          validatedData = createLeadSchema.parse(data);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return new Response(
              JSON.stringify({ error: 'Dados inválidos fornecidos', code: 'VALIDATION_ERROR', details: error.errors }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          throw error;
        }

        const { data: lead, error } = await supabase
          .from("leads")
          .insert([{
            name: validatedData.nome,
            telefone: validatedData.telefone,
            email: validatedData.email,
            cpf: validatedData.cpf,
            value: validatedData.valor || 0,
            etapa_id: validatedData.etapa_id,
            funil_id: validatedData.funil_id,
            company: validatedData.company,
            source: validatedData.source,
            notes: validatedData.notes,
            phone: validatedData.telefone,
            owner_id: user.id,
            company_id: companyId
          }])
          .select()
          .single();

        if (error) {
          console.error("Error creating lead:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao criar lead", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: lead }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case "mover_lead": {
        let validatedData;
        try {
          validatedData = moveLeadSchema.parse(data);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return new Response(
              JSON.stringify({ error: 'Dados inválidos fornecidos', code: 'VALIDATION_ERROR' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          throw error;
        }

        const { error } = await supabase
          .from("leads")
          .update({ etapa_id: validatedData.nova_etapa_id })
          .eq("id", validatedData.lead_id);

        if (error) {
          console.error("Error moving lead:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao mover lead", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case "criar_funil": {
        let validatedData;
        try {
          validatedData = createFunilSchema.parse(data);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return new Response(
              JSON.stringify({ error: 'Dados inválidos fornecidos', code: 'VALIDATION_ERROR' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          throw error;
        }

        console.log('Creating funil with data:', {
          nome: validatedData.nome,
          descricao: validatedData.descricao,
          owner_id: user.id,
          company_id: companyId
        });

        const { data: funil, error } = await supabase
          .from("funis")
          .insert([{ nome: validatedData.nome, descricao: validatedData.descricao, owner_id: user.id, company_id: companyId }])
          .select()
          .single();

        if (error) {
          console.error("Error creating funil:", error);
          console.error("Error details:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          return new Response(
            JSON.stringify({
              error: "Erro ao criar funil",
              code: "DATABASE_ERROR",
              details: error.message
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Funil created successfully:', funil);

        return new Response(
          JSON.stringify({ success: true, data: funil }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case "criar_etapa": {
        let validatedData;
        try {
          validatedData = createEtapaSchema.parse(data);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return new Response(
              JSON.stringify({ error: 'Dados inválidos fornecidos', code: 'VALIDATION_ERROR' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          throw error;
        }

        const { data: etapa, error } = await supabase
          .from("etapas")
          .insert([{ 
            nome: validatedData.nome, 
            funil_id: validatedData.funil_id, 
            posicao: validatedData.posicao || 0, 
            cor: validatedData.cor || '#3b82f6', 
            company_id: companyId 
          }])
          .select()
          .single();

        if (error) {
          console.error("Error creating etapa:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao criar etapa", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: etapa }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case "deletar_lead": {
        let validatedData;
        try {
          validatedData = deleteLeadSchema.parse(data);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return new Response(
              JSON.stringify({ error: 'Dados inválidos fornecidos', code: 'VALIDATION_ERROR' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          throw error;
        }

        const { error } = await supabase
          .from("leads")
          .delete()
          .eq("id", validatedData.lead_id);

        if (error) {
          console.error("Error deleting lead:", error);
          return new Response(
            JSON.stringify({ error: "Erro ao deletar lead", code: "DATABASE_ERROR" }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Ação inválida", code: "INVALID_ACTION" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error("Error in api-funil-vendas:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar requisição", code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});