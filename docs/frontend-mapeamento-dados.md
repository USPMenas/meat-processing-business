# Frontend: Mapeamento de Dados das Telas

## 1. Objetivo

Este documento registra como o frontend em `figma_export` foi conectado a API `https://bor.gs/tcc`, priorizando ao maximo dados reais.

Regra adotada na implementacao:

- primeiro usar dado real da API;
- se a API nao expor exatamente o conceito da tela, derivar o valor a partir da API com regra fixa;
- evitar geracao aleatoria;
- documentar toda derivacao para que a apresentacao da disciplina fique justificavel.

## 2. Resumo da estrategia

## 2.1 O que e 100% API

- consumo por fase;
- consumo total;
- perfil horario;
- picos de demanda;
- fator de potencia;
- tensao;
- janelas de tempo usadas nos graficos;
- comparacao mensal de energia entre periodos reais da base;
- custo energetico base do dashboard executivo.

## 2.2 O que e derivado da API

- temperatura da tela operacional;
- ocupacao da tela operacional;
- ocupacao da tela de logistica;
- "tarifa" da tela de logistica;
- faturamento e margem do dashboard de negocios.

## 2.3 O que nao esta sendo gerado aleatoriamente

Nada do frontend atual depende de `Math.random`.

As poucas partes que nao existem de forma nativa na API usam apenas:

- normalizacao;
- soma entre fases;
- multiplicadores fixos;
- reaproveitamento do perfil horario real;
- regras de visualizacao.

## 3. Arquivos principais envolvidos

## Integracao

- `figma_export/src/app/services/dashboardData.ts`

## Telas

- `figma_export/src/app/pages/OperationalDashboard.tsx`
- `figma_export/src/app/pages/LogisticsDashboard.tsx`
- `figma_export/src/app/pages/BusinessDashboard.tsx`

## Auxiliares

- `figma_export/src/app/components/dashboard/AlertBanner.tsx`
- `figma_export/src/app/components/dashboard/ApiRefreshNotice.tsx`
- `figma_export/src/app/hooks/useDashboardAutoRefresh.ts`
- `figma_export/src/pwa/registerPwa.ts`
- `figma_export/vite.config.ts`

## Testes

- `figma_export/tests/components.unit.test.tsx`
- `figma_export/tests/dashboard-data.test.ts`
- `figma_export/tests/dashboard-refresh.test.tsx`
- `figma_export/tests/platform.render.test.tsx`
- `figma_export/tests/service-calls.test.ts`
- `figma_export/tests/api.integration.test.mjs`

## 3.1 Garantias implementadas no frontend

- o hook de refresh passa opcoes de carga sem corromper o `channel`;
- o service aceita tanto `channel` explicito quanto objeto de opcoes;
- as URLs testadas nao podem conter `[object Object]`;
- o primeiro carregamento tenta reaproveitar cache local antes de forcar nova consulta;
- o refresh de 20 segundos faz nova chamada real apenas no ciclo de `poll`;
- se o browser nao permitir `localStorage`, o cache persistente e desativado com fallback seguro.

## 4. Premissas adotadas

## 4.1 Canal principal

- `channel = lab`

## 4.2 Janela temporal de referencia

Foi mantido como referencia o ultimo timestamp identificado na base analisada:

- `2026-03-31T10:43:04`

Essa data pode ser sobrescrita via `.env`, mas foi fixada por padrao para manter coerencia com o dataset da disciplina.

## 4.3 Tensao nominal

- `127V`

## 4.4 Limites de anomalia de tensao

- `lower_limit = 117`
- `upper_limit = 133`
- `nominal_voltage = 127`

## 4.5 Cache e atualizacao automatica

Regras adotadas:

- cache em memoria para respostas recentes;
- cache persistente em `localStorage` para series historicas e consultas repetidas;
- carregamento inicial com `forceRefresh = false`;
- polling a cada `20 segundos` com `forceRefresh = true`;
- card visual de atualizacao exibido apenas apos resposta bem-sucedida do loader.

Objetivo:

- reduzir carga na API do professor;
- acelerar reabertura das telas;
- manter os graficos historicos estaveis entre navegacoes.

## 5. Mapeamento por tela

## 5.1 Dashboard Operacional

### Card: Energia - Congelador

Origem:

- `GET /lab` com janela de 60 minutos

Transformacao:

- agrupar medicoes por minuto;
- calcular a media de `active_power` da `fase1`;
- usar esse valor como `freezerEnergy`.

Justificativa:

- `fase1` e a fase dominante no trecho mais recente do canal `lab`;
- ela funciona bem como "carga principal" para simular o bloco do congelador.

### Card: Energia - Equipamentos

Origem:

- `GET /lab` com janela de 60 minutos

Transformacao:

- agrupar medicoes por minuto;
- somar a media de `active_power` da `fase2` com a `fase3`.

Formula:

- `equipmentEnergy = fase2.active_power + fase3.active_power`

### Card: Temperatura

Origem:

- `GET /lab` com janela de 60 minutos

Campos usados:

- `voltage`
- `power_factor`

Transformacao:

- media de tensao do minuto;
- media de fator de potencia do minuto;
- conversao da faixa eletrica para uma faixa termica visual de frigorifico.

Formula usada:

- `voltageDriven = normalize(avgVoltage, 124..131.5 -> -20.1..-17.0)`
- `factorPenalty = normalize(avgPowerFactor, 0.2..1.0 -> 0.8..-0.2)`
- `temperature = clamp(voltageDriven + factorPenalty, -20.5, -16.2)`

Observacao:

- esta nao e uma temperatura fisica real;
- e uma leitura derivada da API para sustentar a narrativa visual da tela.

### Card: Ocupacao

Origem:

- `GET /lab` com janela de 60 minutos

Campos usados:

- `active_power` total do minuto

Transformacao:

- somar `fase1 + fase2 + fase3`;
- normalizar o total na faixa recente da ultima hora;
- aplicar um pequeno ajuste por horario para parecer operacionalmente plausivel.

Formula usada:

- `energyDriven = normalize(totalEnergy, min..max -> 52..84)`
- ajuste horario:
  - `7h-18h = +4`
  - `19h-22h = -2`
  - madrugada = `-7`
- `occupancy = clamp(energyDriven + ajuste, 45, 92)`

### Grafico: Consumo Total de Energia

Origem:

- `GET /lab` com janela de 60 minutos

Transformacao:

- `totalEnergy = freezerEnergy + equipmentEnergy`

### Grafico: Comparativo Energia vs Temperatura

Origem:

- `GET /lab` com janela de 60 minutos

Transformacao:

- linha 1: `totalEnergy`
- linha 2: `temperature` derivada

### Alertas

Origem:

- `GET /analytics/lab/electrical_health`
- `GET /analytics/lab/demand_peaks`
- `GET /analytics/lab/voltage_anomalies`

Regras:

- alertas de fator de potencia automaticos foram desativados para evitar falso positivo estrutural do dataset;
- anomalias de tensao so viram alerta agregado acima de `100` ocorrencias na janela;
- pico de demanda so entra como alerta acima de `28 kW`.

Motivo:

- a base `lab` tem comportamento eletrico real de laboratorio, nao de frigorifico;
- quando a regra era muito agressiva, a tela operacional ficava poluida com alertas permanentes de `fase2` e `fase3`;
- a calibracao atual preserva o conceito de alerta sem transformar a dashboard inteira em erro.

## 5.2 Dashboard de Logistica

### Card: Consumo Medio (24h)

Origem:

- `GET /analytics/lab/hourly_profile`

Transformacao:

- pivotar `fase1`, `fase2`, `fase3` por hora;
- somar as tres fases;
- tirar a media das 24 horas.

### Card: Pico de Ocupacao

Origem:

- `GET /analytics/lab/hourly_profile`

Transformacao:

- usar o mesmo `totalEnergy` por hora;
- derivar `occupancy` com a mesma regra base de normalizacao;
- pegar o maior valor.

### Card: Horas Tarifa Baixa

Origem:

- `GET /analytics/lab/hourly_profile`

Importante:

- a API nao possui tarifa eletrica;
- para evitar dado aleatorio, a "tarifa" desta tela foi reinterpretada como um indice de carga derivado do proprio consumo.

Formula:

- `price = normalize(totalEnergy, min..max -> 0.50..0.85)`

Regra do card:

- contar horas em que `price <= 0.58`

### Card: Proximo Horario Ideal

Origem:

- `GET /analytics/lab/hourly_profile`

Transformacao:

- usar a ocupacao derivada e o indice de carga derivado;
- procurar a proxima hora com:
  - `occupancy <= 68`
  - menor `price` possivel

### Grafico: Previsao Ocupacao vs Indice de Carga

Origem:

- `GET /analytics/lab/hourly_profile`

Transformacao:

- reaproveitar o perfil horario real;
- rotacionar a curva a partir da hora de referencia do dataset;
- projetar as proximas 24h repetindo esse padrao.

Observacao:

- nao existe previsao estatistica externa;
- existe reutilizacao do proprio perfil real da API.

### Grafico: Consumo vs Ocupacao (24h)

Origem:

- `GET /analytics/lab/hourly_profile`

Transformacao:

- linha `energy`: soma das fases por hora;
- linha `occupancy`: valor derivado da mesma curva.

## 5.3 Dashboard de Negocios

### Base do dashboard executivo

Origem:

- `GET /analytics/{channel}/consumption` para o mes atual
- `GET /analytics/{channel}/hourly_profile` para o padrao das ultimas 24h
- `GET /analytics/mock01/consumption` para comparacoes historicas fechadas

Regra principal:

- o card executivo usa o total mensal real da API;
- o frontend nao faz mais uma consulta por dia para montar a tela;
- a curva diaria e derivada do total mensal com pesos deterministicos;
- essa curva usa apenas o total real da API e o perfil horario real mais recente.

### Custo Energetico

Origem:

- `total_kwh` da API

Formula:

- `energyCost = total_kwh * 5.45`

Observacao:

- `5.45` e um multiplicador fixo configuravel em `.env`;
- ele representa custo composto de energia na narrativa da disciplina.

### Faturamento Atual

Origem:

- derivado do custo energetico que vem da API

Formula:

- `revenue = energyCost * 8.2`

Observacao:

- o valor nao vem da API;
- mas continua 100% ancorado no consumo real e sem aleatoriedade.

### Projecao Mensal

Origem:

- total mensal real da API no mes corrente

Formula:

- `projectionFactor = diasDoMes / diasRepresentados`
- `projectedRevenue = revenueAtual * projectionFactor`
- `projectedEnergyCost = energyCostAtual * projectionFactor`

### Margem Operacional

Formula:

- `margin = ((revenue - energyCost) / revenue) * 100`

### Grafico: Custo Energetico Diario

Origem:

- `GET /analytics/lab/consumption` para o total do mes
- `GET /analytics/lab/hourly_profile` para calibrar a distribuicao

Transformacao:

- o total mensal real e distribuido entre os dias do mes;
- a distribuicao usa uma curva deterministica sem `Math.random`;
- a curva considera:
  - sazonalidade leve ao longo do mes;
  - diferenca entre dias uteis e fim de semana;
  - intensidade media do perfil horario real das ultimas 24h.

Objetivo:

- manter a tela responsiva;
- evitar dezenas de chamadas diarias;
- continuar ancorado no total real da API.

### Grafico: Comparacao Mensal

Periodos usados:

- `Out/25` via `mock01`
- `Nov/25` via `mock01`
- `Dez/25` via `mock01`
- `Mar/26` via `lab`

Motivo:

- sao os periodos com dados reais aproveitaveis na base;
- `Jan/26` e `Fev/26` nao foram forjados para nao distorcer a narrativa.

### Grafico: Padrao Diario Consumo vs Ocupacao

Origem:

- `GET /analytics/lab/hourly_profile`

Transformacao:

- `avgEnergy`: soma das fases por hora;
- `avgOccupancy`: ocupacao derivada da mesma curva.

## 6. O que ainda nao e dado nativo da API

Mesmo com a estrategia de minimizar geracao, ainda existem conceitos que nao existem explicitamente na API:

- temperatura;
- ocupacao;
- tarifa;
- faturamento;
- margem.

Todos eles, porem, seguem a regra abaixo:

- sao derivados de campos reais da API;
- usam formulas fixas;
- nao usam aleatoriedade;
- podem ser explicados e reproduzidos.

## 7. Decisoes tecnicas relevantes

## CORS

A API `https://bor.gs/tcc` nao expoe cabecalhos de CORS para uso direto no navegador.

Por isso o frontend usa proxy local no Vite:

- `/api/* -> https://bor.gs/tcc/*`

O proxy tambem passou a ter timeout defensivo para nao deixar request travada indefinidamente.

## Polling e refresh visual

Todas as tres telas agora seguem a mesma politica:

- recarregam os dados a cada `20 segundos`;
- o polling ignora o cache local e faz nova consulta real na API;
- o card fixo `Dados atualizados pela API` so aparece quando a resposta volta com sucesso;
- a mensagem desaparece sozinha apos alguns segundos.

Implementacao principal:

- `figma_export/src/app/hooks/useDashboardAutoRefresh.ts`
- `figma_export/src/app/components/dashboard/ApiRefreshNotice.tsx`

## PWA

O frontend agora tambem foi preparado para instalacao no celular como PWA.

Arquivos envolvidos:

- `figma_export/public/manifest.webmanifest`
- `figma_export/public/sw.js`
- `figma_export/public/icons/icon-192.png`
- `figma_export/public/icons/icon-512.png`
- `figma_export/public/icons/apple-touch-icon.png`
- `figma_export/public/icons/icon.svg`
- `figma_export/public/favicon.svg`
- `figma_export/src/pwa/registerPwa.ts`

Escopo da implementacao:

- modo `standalone`;
- icones para Android e iPhone;
- cache do app shell;
- fallback de navegacao para a SPA;
- tentativa de reaproveitar respostas anteriores da API quando houver falha de rede.

Observacao importante:

- a instalacao no celular depende de `HTTPS`;
- o PWA foi adicionado ao projeto, mas para instalacao real fora do desktop local voce ainda precisa servir a aplicacao em ambiente seguro.

## Performance e resiliencia

Mudancas aplicadas para reduzir o tempo de espera:

- remocao de `React.StrictMode` no bootstrap para nao duplicar efeitos e requests no `dev`;
- cache em memoria com deduplicacao de requests em voo;
- retry apenas para `502`, `503` e `504`;
- timeout por request no frontend;
- timeout equivalente no proxy do Vite;
- cache persistente em `localStorage` quando disponivel;
- dashboard de negocios reduzido para poucas chamadas agregadas:
  - comparativos mensais fechados;
  - total mensal atual;
  - perfil horario executivo.

Isso evita que a pagina de negocios fique presa no loading tentando buscar um ponto por dia diretamente da API.

## Arquivo de integracao

Toda a logica de leitura e derivacao esta centralizada em:

- `figma_export/src/app/services/dashboardData.ts`

Isso facilita:

- revisar formulas;
- trocar coeficientes;
- validar o que e dado real e o que e derivado;
- justificar o funcionamento para o professor.

## 8. Parametros configuraveis

O frontend aceita configuracao via `.env`:

- `VITE_TCC_API_BASE`
- `VITE_TCC_CHANNEL`
- `VITE_TCC_DATASET_NOW`
- `VITE_TCC_NOMINAL_VOLTAGE`
- `VITE_TCC_VOLTAGE_LOWER_LIMIT`
- `VITE_TCC_VOLTAGE_UPPER_LIMIT`
- `VITE_TCC_ENERGY_COST_RATE`
- `VITE_TCC_REVENUE_MULTIPLIER`
- `VITE_TCC_CACHE_TTL_MS`
- `VITE_TCC_REQUEST_TIMEOUT_MS`
- `VITE_TCC_BUSINESS_DAILY_LOOKBACK_DAYS`
- `VITE_TCC_BUSINESS_DAILY_CONCURRENCY`
- `VITE_TCC_BUSINESS_COMPARISON_CONCURRENCY`
- `VITE_TCC_DEBUG`

Arquivo base:

- `figma_export/.env.example`

## 9. Conclusao

O frontend foi refeito com a seguinte prioridade:

1. usar dados reais sempre que possivel;
2. quando necessario, derivar o conceito faltante a partir da API;
3. evitar inventar dados sem lastro.

Na pratica, isso deixou a interface muito mais defensavel para a disciplina do que o mock original, porque agora quase toda a tela nasce diretamente do comportamento real do dataset.
