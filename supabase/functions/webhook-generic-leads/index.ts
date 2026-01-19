import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface LeadInput {
  // Nome - múltiplos aliases
  nome?: string;
  name?: string;
  full_name?: string;
  nome_completo?: string;
  customer_name?: string;
  
  // Telefone - múltiplos aliases
  telefone?: string;
  phone?: string;
  celular?: string;
  mobile?: string;
  whatsapp?: string;
  phone_number?: string;
  
  // Email
  email?: string;
  e_mail?: string;
  
  // CPF/Documento
  cpf?: string;
  documento?: string;
  document?: string;
  cpf_cnpj?: string;
  
  // Valor
  valor?: number | string;
  value?: number | string;
  sale_value?: number | string;
  valor_venda?: number | string;
  amount?: number | string;
  
  // Data de nascimento
  data_nascimento?: string;
  birthday?: string;
  aniversario?: string;
  birth_date?: string;
  nascimento?: string;
  
  // Empresa
  empresa?: string;
  company?: string;
  company_name?: string;
  
  // Serviço/Produto
  servico?: string;
  service?: string;
  produto?: string;
  product?: string;
  
  // Origem
  origem?: string;
  source?: string;
  canal?: string;
  channel?: string;
  
  // Tags
  tags?: string[] | string;
  
  // Observações
  observacoes?: string;
  notes?: string;
  mensagem?: string;
  message?: string;
  comentarios?: string;
  
  // UTMs
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  
  // Campos extras (serão salvos nas notas)
  [key: string]: unknown;
}

function normalizePhone(phone: string | undefined): string | null {
  if (!phone) return null;
  
  // Remove tudo que não é número
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length < 10) return null;
  
  // Se começar com 55, mantém; senão, adiciona
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }
  
  return '55' + digits;
}

function normalizeCPF(cpf: string | undefined): string | null {
  if (!cpf) return null;
  return cpf.replace(/\D/g, '');
}

function parseValue(value: number | string | undefined): number | null {
  if (value === undefined || value === null) return null;
  
  if (typeof value === 'number') return value;
  
  // Remove R$, espaços e converte vírgula para ponto
  const cleaned = value.replace(/[R$\s]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? null : parsed;
}

function parseDate(date: string | undefined): string | null {
  if (!date) return null;
  
  // Tenta vários formatos
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
    /^(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
  ];
  
  for (const format of formats) {
    const match = date.match(format);
    if (match) {
      if (format === formats[0]) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      } else {
        return `${match[3]}-${match[2]}-${match[1]}`;
      }
    }
  }
  
  return null;
}

function parseTags(tags: string[] | string | undefined): string[] {
  if (!tags) return [];
  
  if (Array.isArray(tags)) return tags;
  
  // Se for string, divide por vírgula
  return tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
}

function extractMappedFields(input: LeadInput): {
  name: string | null;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  value: number | null;
  birthDate: string | null;
  company: string | null;
  service: string | null;
  source: string | null;
  tags: string[];
  notes: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  extraFields: Record<string, unknown>;
} {
  // Campos conhecidos que serão mapeados
  const knownFields = new Set([
    'nome', 'name', 'full_name', 'nome_completo', 'customer_name',
    'telefone', 'phone', 'celular', 'mobile', 'whatsapp', 'phone_number',
    'email', 'e_mail',
    'cpf', 'documento', 'document', 'cpf_cnpj',
    'valor', 'value', 'sale_value', 'valor_venda', 'amount',
    'data_nascimento', 'birthday', 'aniversario', 'birth_date', 'nascimento',
    'empresa', 'company', 'company_name',
    'servico', 'service', 'produto', 'product',
    'origem', 'source', 'canal', 'channel',
    'tags',
    'observacoes', 'notes', 'mensagem', 'message', 'comentarios',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'api_key' // Ignorar chave de API no payload
  ]);
  
  // Extrai campos extras
  const extraFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!knownFields.has(key) && value !== undefined && value !== null) {
      extraFields[key] = value;
    }
  }
  
  return {
    name: input.nome || input.name || input.full_name || input.nome_completo || input.customer_name || null,
    phone: normalizePhone(input.telefone || input.phone || input.celular || input.mobile || input.whatsapp || input.phone_number),
    email: input.email || input.e_mail || null,
    cpf: normalizeCPF(input.cpf || input.documento || input.document || input.cpf_cnpj),
    value: parseValue(input.valor || input.value || input.sale_value || input.valor_venda || input.amount),
    birthDate: parseDate(input.data_nascimento || input.birthday || input.aniversario || input.birth_date || input.nascimento),
    company: input.empresa || input.company || input.company_name || null,
    service: input.servico || input.service || input.produto || input.product || null,
    source: input.origem || input.source || input.canal || input.channel || 'Webhook',
    tags: parseTags(input.tags),
    notes: input.observacoes || input.notes || input.mensagem || input.message || input.comentarios || null,
    utmSource: input.utm_source || null,
    utmMedium: input.utm_medium || null,
    utmCampaign: input.utm_campaign || null,
    utmContent: input.utm_content || null,
    utmTerm: input.utm_term || null,
    extraFields,
  };
}

serve(async (req) => {
  const startTime = Date.now();
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  
  // Endpoint de status
  if (req.method === 'GET' && action === 'status') {
    return new Response(JSON.stringify({
      status: 'online',
      version: '1.0.0',
      endpoints: {
        'POST /': 'Criar lead via webhook',
        'GET /?action=status': 'Status da API',
        'GET /?action=docs': 'Documentação'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Endpoint de documentação
  if (req.method === 'GET' && action === 'docs') {
    return new Response(JSON.stringify({
      title: 'API de Webhook para Leads',
      version: '1.0.0',
      authentication: {
        type: 'API Key',
        header: 'x-api-key',
        query_param: 'api_key'
      },
      fields: {
        nome: { aliases: ['name', 'full_name', 'nome_completo', 'customer_name'], type: 'string', required: true },
        telefone: { aliases: ['phone', 'celular', 'mobile', 'whatsapp', 'phone_number'], type: 'string' },
        email: { aliases: ['e_mail'], type: 'string' },
        cpf: { aliases: ['documento', 'document', 'cpf_cnpj'], type: 'string' },
        valor: { aliases: ['value', 'sale_value', 'valor_venda', 'amount'], type: 'number' },
        data_nascimento: { aliases: ['birthday', 'aniversario', 'birth_date', 'nascimento'], type: 'string (YYYY-MM-DD)' },
        empresa: { aliases: ['company', 'company_name'], type: 'string' },
        servico: { aliases: ['service', 'produto', 'product'], type: 'string' },
        origem: { aliases: ['source', 'canal', 'channel'], type: 'string' },
        tags: { type: 'array or comma-separated string' },
        observacoes: { aliases: ['notes', 'mensagem', 'message', 'comentarios'], type: 'string' },
        utm_source: { type: 'string' },
        utm_medium: { type: 'string' },
        utm_campaign: { type: 'string' },
        utm_content: { type: 'string' },
        utm_term: { type: 'string' }
      },
      example_payload: {
        nome: 'João Silva',
        telefone: '11999998888',
        email: 'joao@email.com',
        cpf: '123.456.789-00',
        valor: 1500.00,
        data_nascimento: '1990-05-15',
        empresa: 'Empresa ABC',
        servico: 'Consultoria',
        origem: 'Sistema Externo',
        tags: ['VIP', 'Indicação'],
        observacoes: 'Cliente indicado pelo parceiro X',
        utm_source: 'google'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Processar criação de lead
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ 
      error: 'Método não permitido',
      allowed_methods: ['POST', 'GET']
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  let requestBody: LeadInput;
  let apiKeyId: string | null = null;
  let companyId: string | null = null;
  
  try {
    requestBody = await req.json();
  } catch {
    return new Response(JSON.stringify({ 
      error: 'JSON inválido no corpo da requisição'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Obter API Key
  const apiKey = req.headers.get('x-api-key') || url.searchParams.get('api_key') || requestBody.api_key;
  
  if (!apiKey) {
    return new Response(JSON.stringify({ 
      error: 'API Key não fornecida',
      hint: 'Forneça via header x-api-key, query param api_key ou no corpo da requisição'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Validar API Key
  const { data: keyData, error: keyError } = await supabase
    .from('webhook_api_keys')
    .select('id, company_id, is_active, allowed_ips, rate_limit, total_requests')
    .eq('api_key', apiKey)
    .single();
  
  if (keyError || !keyData) {
    // Log de tentativa inválida
    await supabase.from('webhook_logs').insert({
      endpoint: 'webhook-generic-leads',
      request_method: req.method,
      request_body: requestBody,
      response_status: 401,
      error_message: 'API Key inválida',
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
      user_agent: req.headers.get('user-agent'),
      processing_time_ms: Date.now() - startTime,
      company_id: null
    });
    
    return new Response(JSON.stringify({ 
      error: 'API Key inválida'
    }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  if (!keyData.is_active) {
    return new Response(JSON.stringify({ 
      error: 'API Key desativada'
    }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  apiKeyId = keyData.id;
  companyId = keyData.company_id;
  
  // Verificar IP permitido (se configurado)
  if (keyData.allowed_ips && keyData.allowed_ips.length > 0) {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('cf-connecting-ip');
    if (clientIp && !keyData.allowed_ips.includes(clientIp)) {
      await logRequest(supabase, {
        apiKeyId,
        companyId,
        endpoint: 'webhook-generic-leads',
        method: req.method,
        body: requestBody,
        status: 403,
        error: 'IP não permitido',
        startTime,
        req
      });
      
      return new Response(JSON.stringify({ 
        error: 'IP não autorizado'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
  
  // Extrair e mapear campos
  const mapped = extractMappedFields(requestBody);
  
  // Validação básica
  if (!mapped.name) {
    await logRequest(supabase, {
      apiKeyId,
      companyId,
      endpoint: 'webhook-generic-leads',
      method: req.method,
      body: requestBody,
      status: 400,
      error: 'Nome é obrigatório',
      startTime,
      req
    });
    
    return new Response(JSON.stringify({ 
      error: 'Nome é obrigatório',
      received_fields: Object.keys(requestBody)
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  // Buscar funil e etapa padrão
  const { data: defaultFunnel } = await supabase
    .from('funis')
    .select('id')
    .eq('company_id', companyId)
    .limit(1)
    .single();
  
  let defaultStageId: string | null = null;
  if (defaultFunnel) {
    const { data: defaultStage } = await supabase
      .from('etapas')
      .select('id')
      .eq('funil_id', defaultFunnel.id)
      .order('posicao', { ascending: true })
      .limit(1)
      .single();
    
    defaultStageId = defaultStage?.id || null;
  }
  
  // Montar notas com campos extras
  let fullNotes = mapped.notes || '';
  
  if (Object.keys(mapped.extraFields).length > 0) {
    const extraNotesLines: string[] = [];
    for (const [key, value] of Object.entries(mapped.extraFields)) {
      extraNotesLines.push(`${key}: ${JSON.stringify(value)}`);
    }
    
    if (fullNotes) {
      fullNotes += '\n\n--- Campos Extras ---\n' + extraNotesLines.join('\n');
    } else {
      fullNotes = '--- Campos Extras ---\n' + extraNotesLines.join('\n');
    }
  }
  
  // Verificar lead existente por telefone ou email
  let existingLead = null;
  
  if (mapped.phone) {
    const { data: byPhone } = await supabase
      .from('leads')
      .select('id')
      .eq('company_id', companyId)
      .eq('telefone', mapped.phone)
      .limit(1)
      .single();
    
    existingLead = byPhone;
  }
  
  if (!existingLead && mapped.email) {
    const { data: byEmail } = await supabase
      .from('leads')
      .select('id')
      .eq('company_id', companyId)
      .eq('email', mapped.email)
      .limit(1)
      .single();
    
    existingLead = byEmail;
  }
  
  let leadId: string;
  let isUpdate = false;
  
  if (existingLead) {
    // Atualizar lead existente
    isUpdate = true;
    leadId = existingLead.id;
    
    const updateData: Record<string, unknown> = {};
    
    // Atualizar apenas campos fornecidos
    if (mapped.name) updateData.name = mapped.name;
    if (mapped.cpf) updateData.cpf = mapped.cpf;
    if (mapped.value !== null) updateData.value = mapped.value;
    if (mapped.birthDate) updateData.data_nascimento = mapped.birthDate;
    if (mapped.company) updateData.company = mapped.company;
    if (mapped.service) updateData.servico = mapped.service;
    
    // Adicionar nota de atualização
    const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const updateNote = `\n\n--- Atualização via Webhook (${timestamp}) ---\n${fullNotes}`;
    
    const { data: currentLead } = await supabase
      .from('leads')
      .select('notes, tags')
      .eq('id', leadId)
      .single();
    
    updateData.notes = (currentLead?.notes || '') + updateNote;
    
    // Mesclar tags
    if (mapped.tags.length > 0) {
      const existingTags = currentLead?.tags || [];
      const allTags = [...new Set([...existingTags, ...mapped.tags])];
      updateData.tags = allTags;
    }
    
    const { error: updateError } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', leadId);
    
    if (updateError) {
      await logRequest(supabase, {
        apiKeyId,
        companyId,
        endpoint: 'webhook-generic-leads',
        method: req.method,
        body: requestBody,
        status: 500,
        error: `Erro ao atualizar lead: ${updateError.message}`,
        startTime,
        req
      });
      
      return new Response(JSON.stringify({ 
        error: 'Erro ao atualizar lead',
        details: updateError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } else {
    // Criar novo lead
    const leadData = {
      company_id: companyId,
      name: mapped.name,
      telefone: mapped.phone,
      phone: mapped.phone,
      email: mapped.email,
      cpf: mapped.cpf,
      value: mapped.value,
      data_nascimento: mapped.birthDate,
      company: mapped.company,
      servico: mapped.service,
      source: mapped.source,
      tags: mapped.tags.length > 0 ? mapped.tags : ['Webhook'],
      notes: fullNotes || null,
      utm_source: mapped.utmSource,
      utm_medium: mapped.utmMedium,
      utm_campaign: mapped.utmCampaign,
      utm_content: mapped.utmContent,
      utm_term: mapped.utmTerm,
      stage: defaultStageId,
      status: 'Novo',
      probability: 0
    };
    
    const { data: newLead, error: insertError } = await supabase
      .from('leads')
      .insert(leadData)
      .select('id')
      .single();
    
    if (insertError) {
      await logRequest(supabase, {
        apiKeyId,
        companyId,
        endpoint: 'webhook-generic-leads',
        method: req.method,
        body: requestBody,
        status: 500,
        error: `Erro ao criar lead: ${insertError.message}`,
        startTime,
        req
      });
      
      return new Response(JSON.stringify({ 
        error: 'Erro ao criar lead',
        details: insertError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    leadId = newLead.id;
  }
  
  // Atualizar estatísticas da API Key
  await supabase
    .from('webhook_api_keys')
    .update({
      last_used_at: new Date().toISOString(),
      total_requests: keyData.total_requests ? keyData.total_requests + 1 : 1
    })
    .eq('id', apiKeyId);
  
  // Log de sucesso
  await logRequest(supabase, {
    apiKeyId,
    companyId,
    endpoint: 'webhook-generic-leads',
    method: req.method,
    body: requestBody,
    status: isUpdate ? 200 : 201,
    leadId,
    startTime,
    req
  });
  
  return new Response(JSON.stringify({
    success: true,
    action: isUpdate ? 'updated' : 'created',
    lead_id: leadId,
    mapped_fields: {
      name: mapped.name,
      phone: mapped.phone,
      email: mapped.email,
      cpf: mapped.cpf,
      value: mapped.value,
      birth_date: mapped.birthDate,
      company: mapped.company,
      service: mapped.service,
      source: mapped.source,
      tags: mapped.tags
    },
    extra_fields_count: Object.keys(mapped.extraFields).length
  }), {
    status: isUpdate ? 200 : 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logRequest(
  supabaseClient: SupabaseClient<any, any, any>,
  options: {
    apiKeyId: string | null;
    companyId: string | null;
    endpoint: string;
    method: string;
    body: Record<string, unknown>;
    status: number;
    error?: string;
    leadId?: string;
    startTime: number;
    req: Request;
  }
) {
  try {
    await supabaseClient.from('webhook_logs').insert({
      api_key_id: options.apiKeyId,
      company_id: options.companyId,
      endpoint: options.endpoint,
      request_method: options.method,
      request_body: options.body,
      request_headers: {
        'content-type': options.req.headers.get('content-type'),
        'user-agent': options.req.headers.get('user-agent'),
        'x-forwarded-for': options.req.headers.get('x-forwarded-for')
      },
      response_status: options.status,
      error_message: options.error || null,
      lead_id: options.leadId || null,
      ip_address: options.req.headers.get('x-forwarded-for')?.split(',')[0] || options.req.headers.get('cf-connecting-ip'),
      user_agent: options.req.headers.get('user-agent'),
      processing_time_ms: Date.now() - options.startTime
    });
  } catch (e) {
    console.error('Error logging request:', e);
  }
}
