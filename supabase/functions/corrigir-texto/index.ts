// Edge Function para correção automática de texto com IA

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { texto } = await req.json();

    if (!texto || typeof texto !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Texto é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Textos muito curtos (menos de 5 caracteres) não precisam de correção
    if (texto.trim().length < 5) {
      return new Response(
        JSON.stringify({ textoCorrigido: texto, corrigido: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📝 Corrigindo texto:', texto.substring(0, 50) + '...');

    // Usar Lovable AI Gateway para correção rápida
    const response = await fetch('https://llm.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `Você é um corretor de texto em português brasileiro. Sua ÚNICA função é corrigir erros de:
- Ortografia (palavras escritas erradas)
- Acentuação (acrescente acentos onde faltam: á, é, í, ó, ú, ã, õ, ç, â, ê, ô)
- Pontuação (adicione vírgulas e pontos onde necessário)
- Primeira letra maiúscula no início de frases

REGRAS IMPORTANTES:
1. NÃO mude o significado, estilo, tom ou intenção da mensagem
2. NÃO adicione palavras, emojis ou conteúdo novo
3. NÃO remova gírias ou expressões informais (apenas corrija a ortografia delas)
4. NÃO formate ou estruture o texto de forma diferente
5. Mantenha abreviações comuns como "vc" (você), "pq" (porque), "tb" (também) - não expanda elas
6. Retorne APENAS o texto corrigido, sem explicações, aspas ou comentários adicionais
7. Se o texto já estiver correto, retorne exatamente o mesmo texto`
          },
          {
            role: 'user',
            content: texto
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error('❌ Erro na API de IA:', response.status, await response.text());
      // Fallback: retornar texto original se IA falhar
      return new Response(
        JSON.stringify({ textoCorrigido: texto, corrigido: false, erro: 'Erro na correção' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();
    const textoCorrigido = result.choices?.[0]?.message?.content?.trim() || texto;
    
    // Verificar se houve mudanças
    const corrigido = textoCorrigido !== texto;
    
    console.log('✅ Texto corrigido:', textoCorrigido.substring(0, 50) + '...');
    console.log('📊 Teve correções:', corrigido);

    return new Response(
      JSON.stringify({ 
        textoCorrigido, 
        corrigido,
        textoOriginal: texto
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro ao corrigir texto:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar correção' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
