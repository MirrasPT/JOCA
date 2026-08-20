---
name: gdpr-compliance
origin: local
description: "Cookie consent banners, RGPD/GDPR checklists, gating de scripts de terceiros (Google Analytics, Microsoft Clarity) por consentimento, consentimento de formulário validado no servidor com prova em BD, e direitos do titular (acesso/rectificação/apagamento/portabilidade/oposição) para sites de cliente portugueses. MUST be invoked when the user says: RGPD, GDPR, consentimento de cookies, cookie banner, política de privacidade, CNPD, direito ao apagamento, dados pessoais, opt-in. SHOULD also invoke when: formulário de contacto com consentimento, Google Analytics sem consentimento, Microsoft Clarity, DPO, violação de dados, portabilidade de dados."
triggers: RGPD, GDPR, consentimento, cookie banner, cookies, banner de cookies, política de privacidade, CNPD, titular dos dados, direito ao apagamento, dados pessoais, opt-in, cookie wall, consentimento de formulário, Google Analytics consentimento, Microsoft Clarity, DPO, encarregado de protecção de dados, violação de dados, data breach, portabilidade de dados, direito de acesso, direito de oposição, gating de scripts terceiros, consent management
chain: security-review, tester-code
---
# GDPR / RGPD Compliance

Doutrina para conformidade RGPD em sites de cliente PT (Laravel+React ou estáticos) com formulário e/ou analytics. Recorrente: qualquer site com formulário de contacto + Google Analytics/Clarity precisa exactamente disto.

Invocada por `frontend`/`laravel-specialist` quando o pedido envolve cookies/consentimento/formulário com dados pessoais, ou directamente pelo user.

---

## Quando usar

- Site novo ou existente com **formulário** (contacto, newsletter, checkout) que recolhe dados pessoais.
- Site com **Google Analytics, Microsoft Clarity**, pixels de ads, ou qualquer script de terceiros que grava cookies.
- Pedido de **cookie banner**, "estamos conformes com o RGPD?", auditoria de privacidade.
- Implementação de **direito ao apagamento** ou exportação de dados a pedido de um titular.

---

## 1 — Checklist de recolha (por cada ponto de recolha de dados)

Preencher **antes** de escrever código. Uma linha por ponto de recolha (formulário, cookie, integração).

| Dado | Finalidade | Fundamento legal | Prazo de conservação |
|---|---|---|---|
| Nome + email (contacto) | Responder ao pedido | Consentimento / interesse legítimo pré-contratual | Ex.: 12 meses após último contacto |
| Email (newsletter) | Marketing directo | Consentimento (opt-in próprio, separado do formulário de contacto) | Até revogação |
| Cookies de analytics | Medir tráfego/uso | Consentimento | Conforme retenção do vendor (confirmar na consola GA4/Clarity) |
| Dados de encomenda | Execução de contrato + obrigações fiscais | Execução de contrato / obrigação legal | Prazo legal de conservação fiscal (confirmar com contabilista do cliente) |

**Fundamentos legais possíveis** (escolher o correcto, não assumir sempre "consentimento"): consentimento, execução de um contrato, cumprimento de obrigação legal, interesse legítimo. Newsletter e analytics quase sempre exigem **consentimento** — nunca reutilizar o email de um formulário de contacto para newsletter sem um opt-in próprio e separado.

**Prazos de conservação:** nunca "para sempre" por defeito. Se o cliente não tem um número, propor um prazo razoável por finalidade e documentá-lo — não inventar um artigo legal para o justificar.

---

## 2 — Banner de consentimento (padrão)

Regras não-negociáveis:
- **Opt-in prévio** — scripts não-essenciais (analytics, marketing) NÃO correm antes de haver consentimento explícito.
- **Recusar com o mesmo peso visual do Aceitar** — mesmo tamanho, cor, contraste, posição. Nunca "Aceitar" como botão grande colorido e "Recusar" como link cinzento escondido.
- **Granular por categoria** — necessários sempre on (não desligáveis); analytics/marketing off por defeito, ligáveis um a um.
- **Revogável** — link "Preferências de cookies" acessível (footer) a qualquer momento, sem ter de apagar cookies manualmente.
- **Sem cookie-wall** — o site funciona (navega, lê conteúdo, usa formulários essenciais) mesmo com tudo recusado.

```js
// consent.js — estado de consentimento, versionado
const CONSENT_KEY = 'consent_v1'; // subir a versão (v2, v3...) sempre que as categorias mudarem — força re-pergunta

function getConsent() {
  const raw = localStorage.getItem(CONSENT_KEY);
  return raw ? JSON.parse(raw) : null; // null = ainda não decidiu, banner deve aparecer
}

function setConsent(categories) {
  // categories = { necessary: true, analytics: bool, marketing: bool }
  localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...categories, ts: Date.now() }));
  document.dispatchEvent(new CustomEvent('consent:updated', { detail: categories }));
  if (!categories.analytics) purgeCookiesByCategory('analytics');
  if (!categories.marketing) purgeCookiesByCategory('marketing');
}

// ao carregar a página: se já há decisão guardada, disparar o evento (liga scripts já aceites)
const existing = getConsent();
if (existing) document.dispatchEvent(new CustomEvent('consent:updated', { detail: existing }));
```

Banner: 3 acções visíveis — **Aceitar todos**, **Recusar todos** (mesmo peso), **Personalizar** (abre o painel granular). Nunca só 2 opções em que uma delas é "aceitar ou fechar sem decidir" (fechar o banner sem escolher não conta como recusa nem como aceitação — não persistir nada nesse caso).

---

## 3 — Gating de scripts de terceiros + limpeza ao revogar

**Nunca** injectar `<script src="googletagmanager.com/...">` ou o snippet do Clarity directo no `<head>`. Carregar só depois do consentimento:

```html
<script>
document.addEventListener('consent:updated', (e) => {
  if (e.detail.analytics) loadGoogleAnalytics();   // injecta o <script> só aqui
  if (e.detail.marketing) loadMicrosoftClarity();  // idem
});
</script>
```

⚠ **Se o cliente usa Google Ads/remarketing além do GA4, o gate por evento não chega.** A Google exige o próprio sinal (Consent Mode v2: `gtag('consent','default',{...})` antes de qualquer tag, depois `gtag('consent','update',{...})` quando o utilizador decide) para tráfego do EEE/RU. Sem ele o gate parece conforme e as tags continuam a comportar-se como se houvesse consentimento. Verifica na doc actual da Google quais os sinais em vigor — mudam.

Ao **revogar** consentimento previamente dado, além de parar de carregar o script, **limpar os cookies já gravados** dessa categoria — o script deixar de correr não apaga o que já lá está:

```js
function purgeCookiesByCategory(category) {
  // Prefixos documentados pelos vendors — confirmar na doc actual antes de assumir, mudam sem aviso.
  const patterns = {
    analytics: [/^_ga/, /^_gid/, /^_gat/],                          // Google Analytics
    marketing: [/^_clck/, /^_clsk/, /^CLID/, /^MUID/, /^ANONCHK/, /^SM/], // Microsoft Clarity
  };
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if ((patterns[category] || []).some((re) => re.test(name))) {
      const expire = 'expires=Thu, 01 Jan 1970 00:00:00 UTC';
      document.cookie = `${name}=; ${expire}; path=/; domain=${location.hostname}`;
      document.cookie = `${name}=; ${expire}; path=/`; // sem domain também — cookies gravados sem domain explícito só morrem assim
    }
  });
}
```

Cookies `httpOnly` (sessão do servidor, CSRF) não são visíveis a `document.cookie` — não entram nesta purge; classificar como **necessários**, nunca como analytics/marketing.

---

## 4 — Consentimento em formulário (validado no servidor, com prova em BD)

Validação **só no cliente (JS) não conta** — tem de ser reforçada no servidor, com prova persistida.

```php
// Migration
Schema::create('consent_records', function (Blueprint $table) {
    $table->id();
    $table->nullableMorphs('consentable'); // liga a submissão de formulário, lead, user, etc.
    $table->string('email')->nullable();
    $table->string('policy_version');      // versão do texto de privacidade aceite nesse momento
    $table->string('ip_address', 45);
    $table->text('user_agent')->nullable();
    $table->timestamp('consented_at');
    $table->timestamps();
});
```

```php
// FormRequest
public function rules(): array
{
    return [
        'consent' => ['required', 'accepted'], // checkbox nunca pré-marcada — opt-in real
        // ... resto dos campos
    ];
}
```

```php
// Controller/Action — persistir prova ao aceitar o pedido
ConsentRecord::create([
    'consentable_type' => $submission::class,
    'consentable_id'   => $submission->id,
    'email'            => $request->input('email'),
    'policy_version'   => config('legal.privacy_policy_version'),
    'ip_address'       => $request->ip(),
    'user_agent'       => $request->userAgent(),
    'consented_at'     => now(),
]);
```

Regras:
- Checkbox de consentimento **nunca pré-marcada** — `accepted` falha em branco/false, só passa marcada explicitamente.
- `policy_version` sobe **sempre** que o texto de privacidade muda — sem isto a prova aponta para um texto que já não existe.
- Uma conta/lead pode ter múltiplos `consent_records` (contacto ≠ newsletter ≠ marketing) — não colapsar num único booleano `consented`.

---

## 5 — Direitos do titular

| Direito | Implementação |
|---|---|
| **Acesso** | Endpoint/acção admin que exporta todos os dados pessoais ligados ao titular (JSON) |
| **Rectificação** | Formulário de edição de perfil, ou fluxo manual de actualização a pedido |
| **Apagamento** | Anonimizar/apagar em **todas** as tabelas relacionadas — soft-delete da tabela principal não chega (ver gotcha §6) |
| **Portabilidade** | Export estruturado (JSON/CSV), legível por máquina, não um PDF de imagem |
| **Oposição** | Opt-out de marketing sem apagar a conta — flag própria, separada de "conta apagada" |

Prazo de resposta a pedidos: o RGPD dá **1 mês** a contar da recepção, prorrogável até **3 meses** em pedidos complexos (com aviso ao titular dentro do primeiro mês). Trata isto como o tecto legal, não como o SLA — define um SLA interno mais curto e documenta-o com o cliente/DPO. Casos de fronteira (pedidos repetitivos, identidade por confirmar) → DPO.

---

## 6 — Gotcha caro: JOIN a tabelas com flag de consentimento/visibilidade

**Modo de falha real, já aconteceu:** uma flag (`consent_given`, `visible`, `deleted_at`, `anonymized_at`) é respeitada na rota óbvia e **ignorada** noutra rota que faz JOIN à mesma tabela — export admin, endpoint de API, índice de pesquisa, relatório.

Antes de dar a feature por fechada, **auditar TODAS as rotas/queries que tocam a tabela**:

```bash
grep -rn "consent_records\|->join('.*consent\|whereHas('consent" app/
```

Uma flag que só é respeitada em metade dos sítios é pior do que não ter flag nenhuma — passa a auditoria superficial e falha na real.

---

## 7 — Enquadramento CNPD (Portugal)

- **CNPD** é a autoridade nacional de controlo em Portugal; o RGPD é regulamento europeu directamente aplicável, a CNPD fiscaliza e recebe queixas em PT (cnpd.pt).
- Princípios a respeitar no código, sem citar artigo específico: **minimização de dados** (recolher só o necessário), **limitação da finalidade** (não reutilizar dados de um propósito para outro sem consentimento próprio), **limitação do prazo de conservação** (apagar/anonimizar findo o prazo da checklist §1).
- **Violação de dados (data breach):** notificação à autoridade de controlo (CNPD) em **72 horas** a contar do momento em que se toma conhecimento; passado esse prazo, a notificação tem de vir acompanhada da justificação do atraso. Se houver risco elevado para os titulares, estes também são notificados. O canal e o responsável por carregar no botão confirmam-se com o cliente/DPO **antes** de haver incidente, não durante.
- **DPO (Encarregado de Protecção de Dados):** obrigatório em certos cenários (entidades públicas, monitorização em larga escala, tratamento em larga escala de categorias especiais de dados) — confirmar aplicabilidade caso a caso; a maioria dos sites de cliente pequenos **não** precisa de DPO formal, mas precisa sempre de um contacto de privacidade.
- **Nunca citar número de artigo do RGPD nem número de deliberação da CNPD de memória** — um número errado lê-se exactamente como um verdadeiro e é o erro mais caro possível numa peça de conformidade. Escrever o princípio; se o cliente precisa do número exacto, confirmar a fonte antes de publicar.

---

## Anti-patterns

| Errado | Correcto |
|---|---|
| GA/Clarity carregados directo no `<head>`, sem gate | Injectar só depois de `consent:updated` com a categoria activa |
| "Recusar" como link cinzento pequeno, "Aceitar" como botão grande colorido | Mesmo peso visual — tamanho, cor, contraste, posição |
| Site degradado/bloqueado até aceitar (cookie-wall) | Site funciona igual com tudo recusado |
| Checkbox de consentimento pré-marcada | `checked` nunca por defeito |
| Consentimento só validado em JS no cliente | `required\|accepted` no servidor + registo persistido em BD |
| Fechar o banner sem escolher = tratado como aceitação | Sem decisão explícita, banner reaparece; nada se persiste |
| Apagar só a linha principal ao satisfazer "direito ao apagamento" | Auditar todas as tabelas/rotas ligadas por JOIN (§6) |
| Prova de consentimento sem `policy_version` | Guardar a versão do texto aceite; subi-la a cada mudança |
| Reutilizar email de contacto para newsletter sem opt-in próprio | Consentimento separado por finalidade |
| Citar artigo do RGPD/deliberação CNPD de memória | Escrever o princípio; confirmar o número antes de publicar |
| Purga de cookies só sem `domain=` (ou só com) | Tentar as duas variantes — cookies gravados com domain explícito sobrevivem à purga sem domain |

---

## Quality gate

Depois de implementar: dispatch `security-review` (validação server-side do consentimento, exposição de PII em exports/logs, e confirmação de que **todas** as rotas que fazem JOIN à tabela de consentimento/visibilidade respeitam a flag — §6). Se houve formulário novo com endpoint, `tester-code` para o `FormRequest` + persistência do `ConsentRecord`.
