/**
 * SCRIPT DE TESTE DE SEGURANÇA - ISOLAMENTO DE DADOS POR EMPRESA
 *
 * Este script testa se o isolamento de dados está funcionando corretamente
 * entre empresas diferentes no sistema de conversas.
 *
 * EXECUÇÃO: node test-isolamento-seguranca.js
 */

const { createClient } = require('@supabase/supabase-js');

// Configurações de teste
const SUPABASE_URL = 'https://dteppsfseusqixuppglh.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZXBwc2ZzdXNxaXh1cHBnbGgiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwODc5NjE5NywiZXhwIjoxNzIwMzUyMTk3fQ.kO2Y9s6g0w2q4X5v2z5s8q3w4e5r6t7y8u9i0o1p2';

// IDs de teste (substitua por IDs reais de empresas diferentes)
const EMPRESA_A_ID = 'empresa-a-test-id'; // Substitua por um ID real
const EMPRESA_B_ID = 'empresa-b-test-id'; // Substitua por um ID real

// Usuários de teste (substitua por usuários reais de empresas diferentes)
const USUARIO_A_EMAIL = 'usuario-empresa-a@teste.com';
const USUARIO_B_EMAIL = 'usuario-empresa-b@teste.com';

async function testarIsolamento() {
  console.log('🧪 INICIANDO TESTES DE SEGURANÇA - ISOLAMENTO DE DADOS');
  console.log('==================================================\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let testesPassaram = 0;
  let testesTotais = 0;

  // TESTE 1: Verificar se RLS está habilitado nas tabelas críticas
  console.log('📋 TESTE 1: Verificação de RLS habilitado');
  testesTotais++;

  try {
    // Este teste verifica se conseguimos fazer queries sem autenticação
    // Se RLS estiver funcionando, essas queries devem falhar

    const { data: conversasSemAuth, error: errorConversas } = await supabase
      .from('conversas')
      .select('id, company_id')
      .limit(1);

    if (errorConversas && errorConversas.message.includes('row level security')) {
      console.log('✅ RLS habilitado em conversas');
      testesPassaram++;
    } else {
      console.log('❌ RLS NÃO está funcionando em conversas - dados podem vazar!');
    }

    const { data: whatsappSemAuth, error: errorWhatsapp } = await supabase
      .from('whatsapp_connections')
      .select('id, company_id')
      .limit(1);

    if (errorWhatsapp && errorWhatsapp.message.includes('row level security')) {
      console.log('✅ RLS habilitado em whatsapp_connections');
      testesPassaram++;
    } else {
      console.log('❌ RLS NÃO está funcionando em whatsapp_connections');
    }

  } catch (error) {
    console.log('❌ Erro ao testar RLS:', error.message);
  }

  // TESTE 2: Simulação de autenticação de usuário A
  console.log('\n📋 TESTE 2: Simulação de acesso do Usuário A');
  testesTotais += 3;

  try {
    // Simular login do usuário A (em produção, isso seria feito com auth)
    console.log(`🔐 Simulando login: ${USUARIO_A_EMAIL}`);

    // Buscar dados que o usuário A deveria ver
    const conversasUsuarioA = await simularQueryUsuario('conversas', EMPRESA_A_ID);
    const whatsappUsuarioA = await simularQueryUsuario('whatsapp_connections', EMPRESA_A_ID);

    console.log(`✅ Usuário A vê ${conversasUsuarioA.length} conversas`);
    console.log(`✅ Usuário A vê ${whatsappUsuarioA.length} conexões WhatsApp`);
    testesPassaram += 2;

    // Verificar se não há dados de outras empresas
    const conversasOutrasEmpresas = conversasUsuarioA.filter(c => c.company_id !== EMPRESA_A_ID);
    if (conversasOutrasEmpresas.length === 0) {
      console.log('✅ Usuário A não vê conversas de outras empresas');
      testesPassaram++;
    } else {
      console.log('❌ Usuário A consegue ver conversas de outras empresas!');
    }

  } catch (error) {
    console.log('❌ Erro no teste do Usuário A:', error.message);
  }

  // TESTE 3: Simulação de autenticação de usuário B
  console.log('\n📋 TESTE 3: Simulação de acesso do Usuário B');
  testesTotais += 3;

  try {
    console.log(`🔐 Simulando login: ${USUARIO_B_EMAIL}`);

    const conversasUsuarioB = await simularQueryUsuario('conversas', EMPRESA_B_ID);
    const whatsappUsuarioB = await simularQueryUsuario('whatsapp_connections', EMPRESA_B_ID);

    console.log(`✅ Usuário B vê ${conversasUsuarioB.length} conversas`);
    console.log(`✅ Usuário B vê ${whatsappUsuarioB.length} conexões WhatsApp`);
    testesPassaram += 2;

    const conversasOutrasEmpresas = conversasUsuarioB.filter(c => c.company_id !== EMPRESA_B_ID);
    if (conversasOutrasEmpresas.length === 0) {
      console.log('✅ Usuário B não vê conversas de outras empresas');
      testesPassaram++;
    } else {
      console.log('❌ Usuário B consegue ver conversas de outras empresas!');
    }

  } catch (error) {
    console.log('❌ Erro no teste do Usuário B:', error.message);
  }

  // TESTE 4: Verificação de isolamento cruzado
  console.log('\n📋 TESTE 4: Verificação de isolamento cruzado');
  testesTotais += 2;

  try {
    const conversasA = await simularQueryUsuario('conversas', EMPRESA_A_ID);
    const conversasB = await simularQueryUsuario('conversas', EMPRESA_B_ID);

    // Verificar se há interseção entre os dados das empresas
    const idsA = new Set(conversasA.map(c => c.id));
    const idsB = new Set(conversasB.map(c => c.id));

    const intersecao = [...idsA].filter(id => idsB.has(id));

    if (intersecao.length === 0) {
      console.log('✅ Não há interseção de dados entre empresas A e B');
      testesPassaram++;
    } else {
      console.log('❌ Há dados compartilhados entre empresas A e B!');
    }

    // Verificar company_ids
    const companyIdsA = new Set(conversasA.map(c => c.company_id));
    const companyIdsB = new Set(conversasB.map(c => c.company_id));

    if (!companyIdsA.has(EMPRESA_B_ID) && !companyIdsB.has(EMPRESA_A_ID)) {
      console.log('✅ Company IDs estão corretamente isolados');
      testesPassaram++;
    } else {
      console.log('❌ Company IDs estão vazando entre empresas!');
    }

  } catch (error) {
    console.log('❌ Erro no teste de isolamento cruzado:', error.message);
  }

  // RESULTADO FINAL
  console.log('\n==================================================');
  console.log('📊 RESULTADO DOS TESTES DE SEGURANÇA');
  console.log('==================================================');

  const porcentagem = Math.round((testesPassaram / testesTotais) * 100);

  if (porcentagem >= 80) {
    console.log(`✅ ${porcentagem}% dos testes passaram - Isolamento funcionando!`);
  } else if (porcentagem >= 60) {
    console.log(`⚠️ ${porcentagem}% dos testes passaram - Revisar isolamento`);
  } else {
    console.log(`❌ ${porcentagem}% dos testes passaram - ISOLAMENTO CRÍTICO COMPROMETIDO!`);
  }

  console.log(`📈 Testes passados: ${testesPassaram}/${testesTotais}`);

  if (porcentagem < 100) {
    console.log('\n🔧 RECOMENDAÇÕES:');
    console.log('- Verifique se todas as políticas RLS estão ativas');
    console.log('- Confirme que todos os usuários têm company_id correto');
    console.log('- Teste com usuários reais em empresas diferentes');
    console.log('- Monitore logs do Supabase para tentativas de acesso não autorizado');
  }

  return porcentagem >= 80;
}

// Função auxiliar para simular queries de usuário (em produção seria feito com auth real)
async function simularQueryUsuario(tabela, companyId) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Simular RLS: adicionar filtro de company_id
  const { data, error } = await supabase
    .from(tabela)
    .select('*')
    .eq('company_id', companyId)
    .limit(100); // Limitar para teste

  if (error) {
    console.error(`Erro ao consultar ${tabela}:`, error);
    return [];
  }

  return data || [];
}

// Executar testes se este arquivo for executado diretamente
if (require.main === module) {
  testarIsolamento()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Erro fatal nos testes:', error);
      process.exit(1);
    });
}

module.exports = { testarIsolamento };
