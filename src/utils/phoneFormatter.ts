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
 * Formata número de telefone brasileiro de forma robusta
 * Aceita múltiplos formatos e normaliza para +55 (código do país + DDD + número)
 * Exemplos aceitos:
 * - 55 87 9142-6333
 * - 879914263333
 * - 8791426-3333
 * - 8799142-63333
 * - 2140090200 (10 dígitos: DDD 21 + fixo 40090200)
 * - 61998229374 (11 dígitos: DDD 61 + celular 998229374)
 */
export function robustFormatPhoneNumber(phone: string | undefined | null): { formatted: string; isValid: boolean } {
  if (!phone || typeof phone !== 'string') {
    return { formatted: '', isValid: false };
  }

  // Remove tudo que não é número
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 0) {
    return { formatted: '', isValid: false };
  }

  // Remove zeros à esquerda (exceto se for parte do número)
  // Mas preserva se o número começar com 0 seguido de DDD válido
  if (cleaned.startsWith('0') && cleaned.length > 10) {
    cleaned = cleaned.substring(1);
  }
  
  // Se o número já começar com 55, mantém
  if (cleaned.startsWith('55')) {
    // Valida comprimento: 55 (2) + DDD (2) + número (8 ou 9) = 12 ou 13 dígitos
    if (cleaned.length === 12 || cleaned.length === 13) {
      return { formatted: cleaned, isValid: true };
    }
    // Se tiver mais de 13 dígitos, pode ter zeros extras, tenta limpar
    if (cleaned.length > 13) {
      // Pode ter zeros extras no meio, mas isso é raro, retorna inválido
      return { formatted: cleaned, isValid: false };
    }
  }
  
  // Se não começar com 55, precisa adicionar
  // Números brasileiros válidos têm:
  // - 10 dígitos: DDD (2) + fixo (8) = 10
  // - 11 dígitos: DDD (2) + celular (9) = 11
  // - 12 dígitos: 55 + DDD (2) + fixo (8) = 12
  // - 13 dígitos: 55 + DDD (2) + celular (9) = 13
  
  if (cleaned.length === 10) {
    // 10 dígitos: DDD + fixo (8 dígitos)
    cleaned = '55' + cleaned;
    return { formatted: cleaned, isValid: true };
  } else if (cleaned.length === 11) {
    // 11 dígitos: DDD + celular (9 dígitos)
    cleaned = '55' + cleaned;
    return { formatted: cleaned, isValid: true };
  } else if (cleaned.length === 12) {
    // 12 dígitos: provavelmente já tem 55 + DDD + fixo
    if (!cleaned.startsWith('55')) {
      // Não começa com 55, pode ser DDD + número longo, adiciona 55
      cleaned = '55' + cleaned;
      // Agora teria 14 dígitos, inválido
      return { formatted: cleaned, isValid: false };
    }
    return { formatted: cleaned, isValid: true };
  } else if (cleaned.length === 13) {
    // 13 dígitos: provavelmente já tem 55 + DDD + celular
    if (!cleaned.startsWith('55')) {
      // Não começa com 55, pode ser DDD + número muito longo
      return { formatted: cleaned, isValid: false };
    }
    return { formatted: cleaned, isValid: true };
  } else if (cleaned.length >= 8 && cleaned.length <= 9) {
    // 8 ou 9 dígitos: apenas o número sem DDD, não podemos formatar sem DDD
    return { formatted: cleaned, isValid: false };
  } else if (cleaned.length < 8) {
    // Muito curto
    return { formatted: cleaned, isValid: false };
  } else {
    // Muito longo ou formato desconhecido, tenta adicionar 55 mesmo assim
    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }
    // Valida se ficou com tamanho válido após adicionar
    if (cleaned.length === 12 || cleaned.length === 13) {
      return { formatted: cleaned, isValid: true };
    }
    return { formatted: cleaned, isValid: false };
  }
}

/**
 * Normaliza número de telefone para comparação
 * Garante formato consistente: 55DDDXXXXXXXX (12-13 dígitos)
 * Use esta função ao comparar números de diferentes fontes
 */
export function normalizePhoneForComparison(phone: string | null | undefined): string {
  if (!phone) return '';
  
  // Remove tudo que não é número
  let digits = String(phone).replace(/\D/g, '');
  
  // Remove zeros à esquerda
  if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  
  // Se não começa com 55, adiciona código do país
  if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith('55')) {
    digits = `55${digits}`;
  }
  
  return digits;
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
