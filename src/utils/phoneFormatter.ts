/**
 * Formata e valida número de telefone brasileiro
 * Adiciona automaticamente +55 e remove formatação
 */
export function formatPhoneNumber(phone: string): string {
  // Remove tudo que não é número
  let cleaned = phone.replace(/\D/g, '');
  
  // Se começar com 0, remove
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Se não começar com 55, adiciona
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  // Valida comprimento (55 + DDD(2) + número(8 ou 9))
  if (cleaned.length < 12 || cleaned.length > 13) {
    throw new Error('Número inválido. Use o formato: (DDD) 9XXXX-XXXX');
  }
  
  return cleaned;
}

/**
 * Versão segura que não lança erro - retorna string vazia se inválido
 */
export function safeFormatPhoneNumber(phone: string | undefined | null): string {
  if (!phone) return '';
  
  try {
    return formatPhoneNumber(phone);
  } catch {
    // Se falhar, retorna apenas números sem validação
    return phone.replace(/\D/g, '');
  }
}

/**
 * Formata número para exibição: +55 (85) 98765-4321
 */
export function displayPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 13) {
    // +55 (85) 98765-4321
    return `+${cleaned.substring(0, 2)} (${cleaned.substring(2, 4)}) ${cleaned.substring(4, 9)}-${cleaned.substring(9)}`;
  } else if (cleaned.length === 12) {
    // +55 (85) 8765-4321
    return `+${cleaned.substring(0, 2)} (${cleaned.substring(2, 4)}) ${cleaned.substring(4, 8)}-${cleaned.substring(8)}`;
  }
  
  return phone;
}
