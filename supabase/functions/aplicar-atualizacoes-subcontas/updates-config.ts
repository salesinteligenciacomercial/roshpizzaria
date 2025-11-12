// ============================================
// 📋 CONFIGURAÇÃO DE ATUALIZAÇÕES
// ============================================
// Este arquivo define quais atualizações estão disponíveis
// e qual versão cada uma pertence

export interface UpdateDefinition {
  id: string; // ID único da atualização
  version: string; // Versão da atualização (ex: "1.0.0", "1.1.0")
  description: string; // Descrição do que a atualização faz
  appliesTo: 'all' | 'new_only'; // Se aplica a todas ou apenas novas subcontas
  safe: boolean; // Se é seguro executar (não altera dados existentes)
}

export const AVAILABLE_UPDATES: UpdateDefinition[] = [
  {
    id: 'create-default-funil',
    version: '1.0.0',
    description: 'Cria funil padrão e etapas se não existirem',
    appliesTo: 'all',
    safe: true // Apenas cria se não existir
  },
  {
    id: 'create-default-task-board',
    version: '1.0.0',
    description: 'Cria quadro de tarefas padrão se não existir',
    appliesTo: 'all',
    safe: true // Apenas cria se não existir
  },
  {
    id: 'create-whatsapp-connection',
    version: '1.0.0',
    description: 'Cria registro de conexão WhatsApp se não existir',
    appliesTo: 'all',
    safe: true // Apenas cria se não existir
  },
  {
    id: 'fix-conversas-company-id',
    version: '1.0.1',
    description: 'Corrige conversas sem company_id (apenas NULL)',
    appliesTo: 'all',
    safe: true // Apenas corrige NULL, não altera existentes
  }
];

// Versão atual do sistema
export const CURRENT_SYSTEM_VERSION = '1.0.1';

// Função para verificar quais atualizações uma empresa precisa
export function getPendingUpdates(
  appliedVersions: string[],
  isNewCompany: boolean
): UpdateDefinition[] {
  return AVAILABLE_UPDATES.filter(update => {
    // Se já foi aplicada, não precisa aplicar novamente
    if (appliedVersions.includes(update.version)) {
      return false;
    }
    
    // Se é apenas para novas empresas e a empresa não é nova, pular
    if (update.appliesTo === 'new_only' && !isNewCompany) {
      return false;
    }
    
    return true;
  });
}

