// Limpa texto de erro antes de ir para uma nota da auditoria (JSON partilhado no git) ou para o
// ecrã: tira tokens, chaves privadas, JWT e emails de service account, e corta. Usado pelo
// agregador (correr.mjs, nota de erro por módulo) e pelo módulo de contas (#8).

const MAX = 200;
const PADROES = [
  [/-----BEGIN[^-]*KEY-----[\s\S]*?(?:-----END[^-]*KEY-----|$)/g, '[chave removida]'],
  [/\bBearer\s+[^\s"',;]+/gi, 'Bearer [removido]'],
  [/\bya29\.[\w.-]+/g, '[token removido]'],
  [/\b1\/\/0[\w-]{10,}/g, '[token removido]'], // refresh token Google
  [/\beyJ[\w-]*(?:\.[\w-]*){0,2}/g, '[jwt removido]'],
  [/[\w.+-]+@[\w.-]+\.iam\.gserviceaccount\.com\b/gi, '[service account]'],
];

// → primeira linha do texto limpo, com no máximo `max` caracteres.
export function limparErro(texto, max = MAX) {
  let t = String(texto ?? '');
  for (const [re, por] of PADROES) t = t.replace(re, por);
  return t.split(/\r?\n/)[0].trim().slice(0, max);
}
