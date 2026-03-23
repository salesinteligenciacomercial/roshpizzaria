export const SEGMENTOS_EMPRESA = [
  { value: "correspondente_bancario", label: "Correspondente Bancário" },
  { value: "consorcio", label: "Consórcio" },
  { value: "corretora_seguros", label: "Corretora de Seguros" },
  { value: "financeira", label: "Financeira / Empréstimos" },
  { value: "promotora_credito", label: "Promotora de Crédito" },
  { value: "clinica_estetica", label: "Clínica de Estética" },
  { value: "clinica_odontologica", label: "Clínica Odontológica" },
  { value: "clinica_medica", label: "Clínica Médica" },
  { value: "imobiliaria", label: "Imobiliária" },
  { value: "educacao", label: "Educação / Cursos" },
  { value: "varejo", label: "Varejo / Loja" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "tecnologia", label: "Tecnologia / SaaS" },
  { value: "marketing_agencia", label: "Agência de Marketing" },
  { value: "advocacia", label: "Advocacia / Jurídico" },
  { value: "contabilidade", label: "Contabilidade" },
  { value: "consultoria", label: "Consultoria" },
  { value: "alimentacao", label: "Alimentação / Restaurante" },
  { value: "automotivo", label: "Automotivo" },
  { value: "servicos_gerais", label: "Serviços Gerais" },
  { value: "outro", label: "Outro" },
];

// Segmentos que têm acesso ao módulo de Propostas Bancárias
export const SEGMENTOS_FINANCEIROS = [
  "correspondente_bancario",
  "consorcio",
  "corretora_seguros",
  "financeira",
  "promotora_credito",
];

// Segmentos que têm acesso ao módulo Jurídico
export const SEGMENTOS_JURIDICOS = [
  "advocacia",
];

export function isSegmentoFinanceiro(segmento?: string | null): boolean {
  return !!segmento && SEGMENTOS_FINANCEIROS.includes(segmento);
}

export function isSegmentoJuridico(segmento?: string | null): boolean {
  return !!segmento && SEGMENTOS_JURIDICOS.includes(segmento);
}
