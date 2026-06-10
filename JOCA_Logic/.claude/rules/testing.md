# Testing — regras residentes

Procedimento detalhado vive nas skills e nos agents `tester-*`. Aqui só os MUST.

**MUST DO**
- Testar happy paths E error/edge cases (input vazio, null, boundary values)
- Mock de dependências externas — nunca chamar APIs/DBs reais em unit tests
- Descrições `it('…')` que se leiam como especificações em linguagem simples
- Assert de outcomes específicos (`expect(result).toBe(90)`), não truthiness
- Correr testes em CI/CD; documentar e remediar gaps de coverage

**MUST NOT**
- Saltar testes de error-path (não testar só o branch de sucesso)
- Usar dados de produção — fixtures ou factories
- Criar testes order-dependent — cada teste corre isolado
- Ignorar testes flaky — quarentena e fix; nunca re-run até passar
- Testar detalhes de implementação — testar comportamento observável
