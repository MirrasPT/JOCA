---
name: escrever-testes
description: "Escreve testes a partir dos criterios de aceitacao de um issue, deliberadamente sem olhar para a implementacao. Corre em sessao separada da que implementou o codigo. MUST be invoked when the user says: escrever testes, testes do issue, testes a partir dos criterios, /escrever-testes, testes em sessao separada. SHOULD also invoke when: cobrir o issue com testes, testes de aceitacao, Pest a partir do issue, Vitest a partir do issue, flutter test do issue."
triggers: escrever testes, testes do issue, testes a partir dos criterios, escrever-testes, testes em sessao separada, cobrir o issue com testes, testes de aceitacao, Pest a partir do issue, Vitest a partir do issue, flutter test do issue
argument-hint: "[numero-do-issue]"
chain: tester-code, tester-api
---
# Escrever testes — a partir do requisito, nunca do codigo

Escreve testes que verificam o **requisito**, nao a implementacao.

## Regra central

**Nao leias o codigo da implementacao antes de escrever os testes.**

Se o fizeres, escreves testes que passam no codigo que existe — e nao testes que verificam o que
era pedido. Passam sempre e nao provam nada. E o modo de falha mais perigoso deste processo, porque
nao da sinal: o CI fica verde, a cobertura sobe, e a rede de seguranca e uma ilusao.

Idealmente esta skill corre numa sessao que nao implementou nada. Se estas na mesma sessao que
implementou, **di-lo ao utilizador** e sugere abrir sessao nova — nao finjas que o isolamento existe.

## Passos

1. **Ler o issue.** Se `$ARGUMENTS` trouxer um numero, usa-o; caso contrario pergunta qual e.

```bash
gh issue view <numero>
```

Extrair os criterios de aceitacao. Se o issue nao tiver criterios verificaveis, **para** — nao ha
nada a partir do que escrever. Devolve ao `novo-issue`.

2. **Ler o contexto do projeto** — `CLAUDE.md`/`AGENTS.md` e `docs/ARCHITECTURE.md`. Em Laravel, se
o Boost estiver disponivel, usar as ferramentas dele para ler o schema e os modelos: precisas da
**estrutura de dados**, nao da logica das classes.

3. **Ler apenas assinaturas publicas** — rotas, nomes de metodos de controlador, props de
componentes, nomes de modelos. O suficiente para escrever chamadas validas, **nao** a logica interna.

4. **Escrever os testes.** Para cada criterio de aceitacao:
   - o caso nominal
   - pelo menos um caso limite (vazio, nulo, zero, maximo, sem permissao)
   - o caso de erro, quando aplicavel

Preferir sempre o teste que exerce o **comportamento por fora** (HTTP, ecra, ecra renderizado) ao
teste unitario de classes internas — verificam o que o criterio descreve, e sobrevivem a refactors.

### Por stack

| Stack | Runner | Nivel preferido | Comando |
|---|---|---|---|
| Laravel · Livewire | Pest 5 | Feature (HTTP, rotas reais) · `Livewire::test()` | `./vendor/bin/pest --filter=<nome>` |
| Next.js | Vitest + Testing Library | Route handler + render de componente | `npm test -- --run -t <nome>` |
| Flutter | `flutter_test` | Widget test (`testWidgets`) | `flutter test --plain-name <nome>` |

**Laravel:**

```php
it('nao deixa um utilizador ver projetos de outro', function () {
    $outro = User::factory()->has(Project::factory())->create();

    $this->actingAs(User::factory()->create())
        ->get("/projects/{$outro->projects->first()->id}")
        ->assertForbidden();
});
```

**Next.js:**

```ts
it('nao deixa um utilizador ver projetos de outro', async () => {
  const res = await GET(pedidoAutenticadoComo(outroUtilizador), { params: { id: projetoAlheio.id } })
  expect(res.status).toBe(403)
})
```

**Flutter:**

```dart
testWidgets('mostra o estado vazio quando nao ha projetos', (tester) async {
  await tester.pumpWidget(comProjetos([]));
  expect(find.text('Ainda nao tens projetos'), findsOneWidget);
  expect(find.byType(BotaoCriarProjeto), findsOneWidget);
});
```

5. **Correr** e interpretar as falhas:

- Falha porque a funcionalidade nao existe → esperado, se estas a escrever antes
- Falha porque a implementacao nao cumpre o criterio → **encontraste um bug real**
- **Passa tudo a primeira → suspeita.** Muda uma asserção de proposito e confirma que fica vermelha.
  Um teste que nunca falha nao esta a testar nada.

6. **Reportar** que criterios ficaram cobertos, quais nao foi possivel cobrir e porque.

## Nao fazer

- Nao ajustar o teste para passar. Se o teste esta certo e falha, o problema e do codigo.
- Nao testar detalhes internos (metodos privados, estrutura de classes, estado interno de widgets)
  — torna os testes frageis a qualquer refactor.
- Nao perseguir percentagem de cobertura. Perseguir cobertura dos **criterios**.
- **Nao contar cobertura pelo total.** Para verificar que N criterios ficaram cobertos, verificar
  **os N** um a um; uma media ou uma contagem esconde o que falhou.

## Proximo passo (chain)

- Suite escrita e a passar → `tester-code` para rever o diff contra os criterios.
- Houve endpoints novos → `tester-api`.
- Falhou um criterio que revelou bug na implementacao → **nao corrigir aqui**: abrir issue de bug
  (`novo-issue`) ou devolver a quem implementou. Esta skill escreve testes, nao arranja codigo.
