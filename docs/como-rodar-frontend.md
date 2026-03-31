# Como Rodar o Frontend Integrado

## 1. O que existe hoje

O frontend pronto esta em:

- `figma_export`

Ele ja foi adaptado para consumir a API do professor via proxy local do Vite.

Importante:

- a API externa nao libera CORS para chamadas diretas do navegador;
- por isso o frontend deve ser rodado via `npm run dev`, que usa o proxy configurado em `vite.config.ts`.

## 2. Requisitos

Voce precisa ter instalado:

- `Node.js` 18 ou superior
- `npm`

## 3. Primeiro setup

No terminal, a partir da raiz do projeto:

```powershell
cd .\figma_export
npm install
```

## 4. Arquivo de ambiente

Existe um exemplo pronto:

- `figma_export/.env.example`

Se quiser, pode copiar para `.env`, mas para rodar localmente com os valores atuais nem e obrigatorio.

Valores padrao usados hoje:

```env
VITE_TCC_API_BASE=/api
VITE_TCC_CHANNEL=lab
VITE_TCC_DATASET_NOW=2026-03-31T10:43:04
VITE_TCC_NOMINAL_VOLTAGE=127
VITE_TCC_VOLTAGE_LOWER_LIMIT=117
VITE_TCC_VOLTAGE_UPPER_LIMIT=133
VITE_TCC_ENERGY_COST_RATE=5.45
VITE_TCC_REVENUE_MULTIPLIER=8.2
VITE_TCC_CACHE_TTL_MS=300000
VITE_TCC_PERSISTENT_CACHE_TTL_MS=21600000
VITE_TCC_REQUEST_TIMEOUT_MS=10000
VITE_TCC_BUSINESS_REQUEST_TIMEOUT_MS=25000
VITE_TCC_BUSINESS_COMPARISON_CONCURRENCY=2
VITE_TCC_DEBUG=0
```

## 5. Rodando em desenvolvimento

Dentro de `figma_export`:

```powershell
npm run dev
```

Depois abra no navegador a URL que o Vite mostrar, normalmente:

- `http://localhost:5173`

Observacoes importantes:

- as dashboards fazem refresh automatico a cada `20 segundos`;
- o primeiro carregamento reaproveita cache local quando existir;
- os polls de 20 em 20 segundos forcam nova leitura da API;
- consultas historicas passam por cache em memoria e `localStorage` para reduzir peso na API;
- a tela de negocios foi reduzida para poucas consultas agregadas, evitando uma chamada por dia;
- o card `Dados atualizados pela API` aparece apenas quando uma nova consulta volta com sucesso;
- se voce mudar `vite.config.ts`, reinicie o `npm run dev`.

## 6. Como a API entra no frontend

Durante o `npm run dev`, o Vite faz proxy desta forma:

- frontend chama `/api/...`
- Vite redireciona para `https://bor.gs/tcc/...`

Exemplo:

- frontend: `/api/analytics/lab/consumption`
- destino real: `https://bor.gs/tcc/analytics/lab/consumption`

## 7. Build de producao

Para verificar se o projeto compila:

```powershell
npm run build
```

O build gera a pasta:

- `figma_export/dist`

## 7.1 PWA e instalacao no celular

O frontend agora foi preparado como PWA com:

- `manifest.webmanifest`
- `service worker`
- icones para Android e iPhone
- metatags de instalacao mobile

Arquivos principais:

- `figma_export/public/manifest.webmanifest`
- `figma_export/public/sw.js`
- `figma_export/src/pwa/registerPwa.ts`

Como instalar:

- Android/Chrome:
  - abra a aplicacao no navegador;
  - espere o app carregar;
  - use o menu do Chrome e toque em `Instalar app` ou `Adicionar a tela inicial`.
- iPhone/Safari:
  - abra a aplicacao no Safari;
  - toque em `Compartilhar`;
  - escolha `Adicionar a Tela de Inicio`.

Importante:

- PWA instalavel exige contexto seguro;
- `localhost` funciona para desenvolvimento no proprio computador;
- no celular, um endereco `http://IP:5173` normalmente nao permite instalacao;
- para instalar no celular de verdade, voce precisa servir o app em `HTTPS`.

Como este projeto depende de proxy para a API, o caminho mais seguro para instalacao real e:

1. publicar o frontend com HTTPS;
2. manter um proxy/backend que exponha `/api/*` para `https://bor.gs/tcc/*`.

## 7.2 Teste de integracao com a API

Para rodar toda a suite:

```powershell
npm run test
```

Ela executa:

- testes de UI e renderizacao;
- testes unitarios dos componentes principais;
- testes de mapeamento e derivacao dos dados;
- testes de montagem correta das URLs e reaproveitamento de cache;
- testes de refresh automatico;
- testes de integracao contra a API real.

Se quiser rodar separado:

- `npm run test:ui`
- `npm run test:integration`

Para validar se a API do professor esta respondendo nos contratos esperados:

```powershell
npm run test:integration
```

Esse teste verifica, contra a API real:

- `openapi.json`
- `analytics/lab/consumption`
- `analytics/lab/hourly_profile`
- `lab`

Tambem foi adicionada cobertura de PWA na suite de UI para validar:

- manifesto com `display: standalone`;
- existencia dos icones mobile;
- registro do service worker.

Arquivos de teste principais:

- `figma_export/tests/components.unit.test.tsx`
- `figma_export/tests/service-calls.test.ts`
- `figma_export/tests/platform.render.test.tsx`
- `figma_export/tests/api.integration.test.mjs`

## 8. Observacao importante sobre preview/producao

O `build` compila normalmente, mas o problema de CORS continua existindo fora do servidor de desenvolvimento.

Em outras palavras:

- `npm run dev` funciona porque existe proxy;
- um deploy estatico puro vai precisar de proxy proprio ou backend intermediario.

Se voce quiser apresentar localmente, use:

- `npm run dev`

Isso e o caminho mais seguro para a disciplina.

## 9. O que foi trocado no frontend

O mock antigo foi removido e substituido por:

- leitura real da API;
- derivacoes fixas baseadas na API;
- formulas documentadas para temperatura, ocupacao, tarifa e indicadores financeiros.

Detalhes completos:

- `docs/frontend-mapeamento-dados.md`

## 10. Dicas para apresentar

Se voce quiser evitar surpresas na hora da apresentacao:

1. rode `npm install` antes, para garantir dependencias;
2. rode `npm run dev`;
3. abra as tres telas e confirme carregamento;
4. deixe a documentacao aberta para justificar as derivacoes;
5. se o professor perguntar sobre coerencia setorial, explique que:
   - a API e de laboratorio;
   - os conceitos de frigorifico foram mapeados por reinterpretacao;
   - os dados da interface estao ancorados na API e nao em mock aleatorio.

## 11. Arquivos mais importantes para manutencao

- `figma_export/src/app/services/dashboardData.ts`
- `figma_export/src/app/pages/OperationalDashboard.tsx`
- `figma_export/src/app/pages/LogisticsDashboard.tsx`
- `figma_export/src/app/pages/BusinessDashboard.tsx`
- `figma_export/vite.config.ts`

## 12. Status atual

Validado:

- `npm install`
- `npm run build`
- `npm run test`
- `npm run test:integration`

Status adicional garantido pelos testes:

- loaders aceitam objeto de opcoes sem quebrar o `channel`;
- URLs da API nao sao montadas com `[object Object]`;
- o cache evita refetch imediato de series historicas;
- o dashboard de negocios nao depende mais de dezenas de requests diarios para renderizar;
- as tres paginas continuam renderizando com os contratos esperados.

Isso significa que a estrutura do projeto esta pronta e compilando.
