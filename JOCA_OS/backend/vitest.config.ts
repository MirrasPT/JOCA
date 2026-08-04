import { defineConfig } from 'vitest/config';
import os from 'os';
import path from 'path';

// Os testes escrevem e APAGAM ficheiros de `DATA_DIR` (`notifications.test.ts` e `manager.test.ts`
// fazem `fs.rmSync` para isolar cada caso). Sem este override apontavam aos dados reais: correr
// `npm test` apagava as notificações e o chat do gestor de quem tivesse o JOCA a sério nesta cópia.
// `env` é aplicado antes de qualquer módulo ser importado, que é o que faz o `project-store` ler
// já o valor certo — um `setupFiles` chegaria tarde por causa do hoisting dos imports.
export default defineConfig({
  test: {
    env: {
      JOCA_DATA_DIR: path.join(os.tmpdir(), 'joca-os-test-data'),
    },
  },
});
