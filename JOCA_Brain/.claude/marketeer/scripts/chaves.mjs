// Canal do dossier → chave(s) do cofre que guardam a credencial desse canal (D-017, I1 do #10).
// Tabela única: o resumo (scripts/resumo.mjs) prova o acesso por ela e o módulo de contas (#8) lê
// a credencial por ela. Canal fora dela → acesso por confirmar, nunca "sim" pelo dossier.
//
// GOOGLE_SERVICE_ACCOUNT guarda o CAMINHO do JSON da service account, não o conteúdo (o cofre
// só aceita valores numa linha); o JSON lê-se só dentro do módulo que o usa.
export const CHAVES_DO_COFRE = {
  ga4: ['GOOGLE_SERVICE_ACCOUNT'],
  'search-console': ['GOOGLE_SERVICE_ACCOUNT'],
  // Refresh token OAuth do utilizador Google com acesso à conta (D-019). O token de programador e o
  // OAuth client são da agência e vivem no cofre `google-ads`, não no do cliente.
  'google-ads': ['GOOGLE_ADS_REFRESH_TOKEN'],
};
