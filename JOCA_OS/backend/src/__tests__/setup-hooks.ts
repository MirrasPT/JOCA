// Cada ficheiro de testes que abre um terminal claude cria a pasta privada de hooks deste processo
// (agent-bridge.prepareClaudeHooksSettings). A saída limpa do processo não corre nos workers do
// vitest, por isso apaga-se aqui. Import dinâmico: um import estático carregava o project-store
// ANTES do `vi.hoisted` dos ficheiros que mudam o JOCA_DATA_DIR, e eles perdiam o isolamento.
import { afterAll } from 'vitest';

afterAll(async () => {
  (await import('../agent-bridge')).removeClaudeHooksSettings();
});
