/*
  CI regression guard: verifies critical features are present to prevent accidental rollbacks.
  Run with: node scripts/check-regressions.js
*/

const fs = require('fs');
const path = require('path');

function read(file) {
  const p = path.resolve(process.cwd(), file);
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    throw new Error(`Missing file: ${file}`);
  }
}

function assertContains(file, content, patterns) {
  const errors = [];
  for (const pat of patterns) {
    const re = new RegExp(pat, 'm');
    if (!re.test(content)) {
      errors.push(`- ${file} is missing pattern: ${pat}`);
    }
  }
  return errors;
}

const checks = [
  {
    file: 'src/pages/Conversas.tsx',
    patterns: [
      'callEdgeFunctionWithRetry',
      'setupRealtimeChannel',
      'transcribeAudioWithRetry',
      'MediaUpload',
      'Grupos'
    ],
  },
  {
    file: 'src/components/conversas/MessageItem.tsx',
    patterns: [
      'transcriptionStatus',
      'Loader2'
    ],
  },
  {
    file: 'src/components/conversas/MediaUpload.tsx',
    patterns: [
      'compressImage',
      'uploadFileInChunks',
      'Progress'
    ],
  },
  {
    file: 'src/components/conversas/NovaConversaDialog.tsx',
    patterns: [
      'MessageSquarePlus',
      'size="icon"'
    ],
  },
  {
    file: 'src/components/conversas/ConversationListItem.tsx',
    patterns: [
      'memo\(function\s+ConversationListItem'
    ],
  },
  {
    file: 'src/components/conversas/ConversationHeader.tsx',
    patterns: [
      'Finalizar'
    ],
  },
  {
    file: 'src/pages/Leads.tsx',
    patterns: [
      'ConversaPopup',
      'useLeadsSync'
    ],
  },
  {
    file: 'src/components/leads/ConversaPopup.tsx',
    patterns: [
      'MediaUpload',
      'AudioRecorder',
      'scheduled_whatsapp_messages'
    ],
  },
];

let failed = [];
for (const c of checks) {
  const content = read(c.file);
  failed = failed.concat(assertContains(c.file, content, c.patterns));
}

if (failed.length) {
  console.error('❌ Regression guard failed. Missing required features in current commit:');
  for (const e of failed) console.error(e);
  console.error('\nPlease restore micro-prompt improvements before pushing to protected branches.');
  process.exit(1);
}

console.log('✅ Regression guard passed.');


