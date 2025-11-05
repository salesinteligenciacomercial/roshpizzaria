/*
  CI regression guard: verifies critical features are present to prevent accidental rollbacks.
  Run with: node ceusia-ai-hub/scripts/check-regressions.cjs
*/

const fs = require('fs');
const path = require('path');

// Ensure we run from ceusia-ai-hub root if script called from repo root
try {
  const hubDir = path.resolve(process.cwd(), 'src');
  if (!fs.existsSync(hubDir)) {
    const candidate = path.resolve(process.cwd(), 'ceusia-ai-hub');
    if (fs.existsSync(path.join(candidate, 'src'))) {
      process.chdir(candidate);
    }
  }
} catch {}

function read(file) {
  const p = path.resolve(process.cwd(), file);
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    throw new Error(`Missing file: ${file}`);
  }
}

function assertRegex(file, content, regexps) {
  const errors = [];
  for (const r of regexps) {
    const re = new RegExp(r, 'ms');
    if (!re.test(content)) {
      errors.push(`- ${file} is missing pattern: /${r}/`);
    }
  }
  return errors;
}

const checks = [
  // Conversas: wrappers e normalização (preserva grupos @g.us) + filtro Grupos
  { file: 'src/pages/Conversas.tsx', regex: [
    'callEdgeFunctionWithRetry',
    'sendWhatsAppWithRetry',
    'transcribeAudioWithRetry',
    'const\\s+normalizePhoneForWA[\n\r\t\s]*=([\n\r\t\s\S]*?)@g\\\.us',
    'filter\\(\"group\"\)[\s\S]*conv\\.isGroup\s*===\s*true|filter\(\)\s*=>\s*conv\\.isGroup\s*===\s*true',
    'quotedMessageId',
    'mimeType',
    'fileName',
  ]},
  // Mensagem item mantém status de transcrição
  { file: 'src/components/conversas/MessageItem.tsx', regex: ['transcriptionStatus'] },
  // Lista conversa memoizada
  { file: 'src/components/conversas/ConversationListItem.tsx', regex: ['export\\s+const\\s+ConversationListItem\\s*=\\s*memo'] },
  // Enviar WhatsApp Edge deve suportar grupos (groupId) e contatos (number)
  { file: 'supabase/functions/enviar-whatsapp/index.ts', regex: ['@g\\\.us', 'groupId', 'number'] },
  // Webhook deve aceitar is_group e fromMe
  { file: 'supabase/functions/webhook-conversas/index.ts', regex: ['is_group', 'fromMe'] },
];

let failed = [];
for (const c of checks) {
  const content = read(c.file);
  failed = failed.concat(assertRegex(c.file, content, c.regex));
}

if (failed.length) {
  console.error('❌ Regression guard failed. Missing required features in current commit:');
  for (const e of failed) console.error(e);
  console.error('\nPlease restore micro-prompt improvements before pushing to protected branches.');
  process.exit(1);
}

console.log('✅ Regression guard passed.');
