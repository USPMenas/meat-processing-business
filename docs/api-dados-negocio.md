# Documentacao Inicial de Dados

## 1. Objetivo deste documento

Este documento transforma a API `https://bor.gs/tcc` em uma especificacao de dados util para o projeto da disciplina.

O foco aqui nao e provar coerencia setorial real de um frigorifico, e sim:

- entender o que a API realmente entrega;
- decidir o que entra direto no dashboard;
- identificar o que precisa ser derivado;
- deixar claro o que vai precisar existir em um banco local com dados sinteticos para preencher as telas de negocio.

## 2. Fonte analisada

- Swagger/OpenAPI: `https://bor.gs/tcc`
- OpenAPI JSON: `https://bor.gs/tcc/openapi.json`
- Backup analisado localmente: `backup_2026-03-31.db`

Analise realizada em `31/03/2026`.

## 3. Resumo executivo

### O que a API entrega bem

- medicoes eletricas brutas por canal e por sensor;
- potencia ativa, reativa e aparente;
- fator de potencia;
- corrente;
- tensao;
- agregacoes prontas para consumo, picos, perfil horario e saude eletrica;
- deteccao de anomalias de tensao.

### O que a API nao entrega

- producao do frigorifico;
- volume processado;
- estoque;
- ocupacao de camaras frias;
- pedidos;
- faturamento;
- custo operacional;
- manutencao;
- indicadores financeiros;
- setores ou maquinas reais do frigorifico.

### Decisao recomendada

- usar o canal `lab` como base principal da demonstracao;
- tratar `fase1`, `fase2` e `fase3` como fontes eletricas da planta, nao como maquinas reais;
- construir uma camada local de dados sinteticos para todos os KPIs de negocio;
- correlacionar os dados sinteticos com os dados energeticos para a dashboard parecer consistente.

## 4. Inventario real da base

## 4.1 Tabela existente no backup

Existe apenas uma tabela:

- `measurements`

Schema identificado:

| Campo | Tipo | Obrigatorio | Observacao |
| --- | --- | --- | --- |
| `timestamp` | `TEXT` | sim | data/hora ISO |
| `channel` | `TEXT` | sim | agrupador principal |
| `sensor` | `TEXT` | sim | no dataset atual representa fase |
| `apparent_power` | `REAL` | nao | potencia aparente |
| `active_power` | `REAL` | nao | potencia ativa |
| `reactive_power` | `REAL` | nao | potencia reativa |
| `power_factor` | `REAL` | nao | fator de potencia |
| `voltage` | `REAL` | nao | tensao |
| `current` | `REAL` | nao | corrente |

## 4.2 Volume da base

| Indicador | Valor |
| --- | --- |
| Total de medicoes | `4.478.380` |
| Canais distintos | `3` |
| Sensores distintos | `3` |
| Primeiro timestamp | `2025-10-01T03:00:00` |
| Ultimo timestamp | `2026-03-31T10:43:04` |
| Campos nulos nas metricas principais | `0` |

## 4.3 Canais disponiveis

| Canal | Registros | Sensores | Inicio | Fim | Uso recomendado |
| --- | --- | --- | --- | --- | --- |
| `lab` | `2.092.540` | `3` | `2025-12-01T19:20:42` | `2026-03-31T10:43:04` | principal para demo |
| `mock01` | `2.384.640` | `3` | `2025-10-01T03:00:00` | `2026-01-01T02:59:50` | fallback e testes |
| `mock02` | `1.200` | `3` | `2025-10-01T03:00:00` | `2025-10-01T04:06:30` | edge case/baixo volume |

## 4.4 Sensores disponiveis

Todos os canais usam os mesmos sensores:

- `fase1`
- `fase2`
- `fase3`

Interpretacao recomendada para o projeto:

- no backend e na documentacao tecnica, manter como `fase1`, `fase2`, `fase3`;
- na UI, podemos exibir como "Fase 1", "Fase 2" e "Fase 3";
- nao tratar esses sensores como camara fria, linha de corte ou equipamento especifico, porque a API nao fornece esse nivel de granularidade.

## 4.5 Cobertura temporal e qualidade do canal `lab`

O canal `lab`, que e o melhor candidato para a demonstracao, tem uma observacao importante:

- ha dados entre `01/12/2025` e `27/12/2025`;
- depois existe um gap de `78` dias;
- os dados voltam entre `16/03/2026` e `31/03/2026`.

Implicacao:

- para cards "ultimos 7 dias", "ultimos 15 dias" e "hoje", o canal `lab` atende bem;
- para series mais longas, como "ultimos 90 dias", sera preciso aceitar o gap ou trocar para `mock01`;
- o dashboard deve sempre trabalhar com filtros de periodo explicitos.

## 4.6 Faixas reais observadas no canal `lab`

| Sensor | Potencia ativa media (kW) | Potencia ativa max (kW) | Tensao media (V) | Corrente media | FP medio |
| --- | --- | --- | --- | --- | --- |
| `fase1` | `8,196` | `36,906` | `129,289` | `0,0711` | `0,863` |
| `fase2` | `4,161` | `30,152` | `130,152` | `0,0543` | `0,535` |
| `fase3` | `7,949` | `25,272` | `129,685` | `0,0759` | `0,801` |

Leituras importantes:

- a tensao real do dataset gira perto de `127V-130V`, nao de `220V`;
- `fase2` tem fator de potencia medio bem pior que as demais e pode render bons alertas;
- o dataset e suficiente para construir uma narrativa de monitoramento energetico e saude eletrica.

## 5. Catalogo da API

## 5.1 Endpoints brutos

### `GET /{channel}`

Retorna medicoes de todos os sensores de um canal.

Parametros:

- `channel` obrigatorio
- `from_time` opcional
- `to_time` opcional

Uso no projeto:

- tela de historico bruto;
- debug;
- exportacoes;
- base para agregacoes customizadas no app, caso precisemos.

Comportamento observado:

- retorno em ordem decrescente de `timestamp`;
- sem filtro de tempo o payload tende a ser muito grande;
- para `lab` em uma janela de 5 minutos houve `180` registros.

### `GET /{channel}/{sensor}`

Retorna medicoes de um sensor especifico dentro de um canal.

Uso no projeto:

- drill-down por fase;
- grafico detalhado da fase selecionada;
- comparacao entre fases.

### `POST /measurements`

Cria uma medicao.

Uso recomendado nesta fase:

- nao necessario para o MVP da dashboard;
- pode ser util no futuro se quisermos simular ingestao ou inserir dados mockados.

## 5.2 Endpoints analiticos

### `GET /analytics/{channel}/consumption`

Retorna, por sensor:

- `total_kwh`
- `min_demand_kw`
- `max_demand_kw`

Uso no projeto:

- card de consumo do periodo;
- comparativo entre fases;
- estimativa de custo de energia;
- base para KPI "custo energetico por tonelada" quando combinado com dados sinteticos.

### `GET /analytics/{channel}/demand_peaks`

Retorna, por sensor:

- `peak_kw`
- `timestamp`

Uso no projeto:

- card de pico do dia;
- lista de ocorrencias criticas;
- gatilho para alertas operacionais.

### `GET /analytics/{channel}/electrical_health`

Retorna, por sensor:

- `avg_voltage`
- `avg_power_factor`

Uso no projeto:

- saude eletrica;
- eficiencia energetica;
- alertas de fator de potencia baixo;
- qualidade do fornecimento por fase.

### `GET /analytics/{channel}/hourly_profile`

Retorna, por hora e por sensor:

- `hour`
- `avg_power_kw`

Uso no projeto:

- grafico principal de perfil de carga por hora;
- comparacao de turnos;
- identificacao de horarios de maior consumo.

### `GET /analytics/{channel}/current_by_sensor`

Retorna, por sensor:

- `avg_current`

Uso no projeto:

- card resumido de corrente media;
- comparacao por fase;
- suporte a analise de desequilibrio.

### `GET /analytics/{channel}/voltage_anomalies`

Retorna eventos de tensao fora do limite.

Parametros adicionais:

- `lower_limit`
- `upper_limit`
- `nominal_voltage`

Uso no projeto:

- feed de alertas;
- historico de anomalias;
- indicador de estabilidade eletrica.

Comportamentos observados:

- o endpoint parece limitar o retorno a `50` eventos, mesmo em janelas maiores;
- com limites de `220V`, praticamente tudo vira anomalia no canal `lab`;
- para o dataset atual, faz mais sentido usar algo como:
  - `nominal_voltage = 127`
  - `lower_limit = 117`
  - `upper_limit = 133`

## 5.3 Exemplo real de resposta

Exemplo de `GET /analytics/lab/consumption?from_time=2026-03-30T00:00:00&to_time=2026-03-30T01:00:00`:

```json
{
  "channel": "lab",
  "from": "2026-03-30T00:00:00",
  "to": "2026-03-30T01:00:00",
  "results": [
    {
      "sensor": "fase1",
      "total_kwh": 4.37,
      "min_demand_kw": 4.06,
      "max_demand_kw": 5.49
    },
    {
      "sensor": "fase2",
      "total_kwh": 1.58,
      "min_demand_kw": 1.55,
      "max_demand_kw": 2.35
    },
    {
      "sensor": "fase3",
      "total_kwh": 5.77,
      "min_demand_kw": 5.66,
      "max_demand_kw": 6.27
    }
  ]
}
```

## 6. Mapeamento API -> dashboard do frigorifico

Como as telas ainda nao foram compartilhadas neste workspace, o mapeamento abaixo e a melhor proposta inicial para validacao. Assim que as telas do Figma entrarem, este documento deve ser refinado componente por componente.

## 6.1 Bloco: resumo operacional do dia

KPIs que podem vir da API:

- consumo total do periodo: `analytics/{channel}/consumption`
- maior pico de demanda: `analytics/{channel}/demand_peaks`
- tensao media por fase: `analytics/{channel}/electrical_health`
- fator de potencia medio: `analytics/{channel}/electrical_health`
- corrente media por fase: `analytics/{channel}/current_by_sensor`

## 6.2 Bloco: grafico principal de consumo

Fonte recomendada:

- `analytics/{channel}/hourly_profile`

Uso visual:

- linha ou area por fase;
- alternancia entre "ultimas 24h", "ultimos 7 dias" e "periodo customizado".

## 6.3 Bloco: comparativo entre fases

Fontes recomendadas:

- `analytics/{channel}/consumption`
- `analytics/{channel}/current_by_sensor`
- `analytics/{channel}/electrical_health`

Uso visual:

- cards pequenos por fase;
- barras comparativas;
- ranking da fase mais critica.

## 6.4 Bloco: feed de alertas

Fonte recomendada:

- `analytics/{channel}/voltage_anomalies`

Alertas derivados adicionais:

- fator de potencia abaixo de meta;
- pico acima de limite;
- consumo acima da media do periodo;
- desequilibrio relevante entre fases.

## 6.5 Bloco: historico detalhado

Fontes recomendadas:

- `/{channel}`
- `/{channel}/{sensor}`

Uso visual:

- tabela simplificada;
- pagina de detalhe;
- exportacao futura.

## 7. O que precisa ser sintetico/local

Se alguma tela mostrar indicadores de negocio do frigorifico, eles nao existem na API e devem nascer no banco local.

## 7.1 Dados que certamente precisarao ser locais

- quantidade de animais processados por dia;
- toneladas processadas;
- ocupacao das camaras frias;
- temperatura interna por camara;
- pedidos em aberto;
- status logistico;
- faturamento diario;
- custo operacional nao energetico;
- custo total por kg;
- manutencoes programadas;
- incidentes operacionais;
- usuarios e permissoes;
- metas da planta.

## 7.2 Regra de ouro para os dados sinteticos

Os dados locais nao devem ser totalmente aleatorios. Eles devem parecer conectados com a energia.

Exemplos:

- se o consumo do dia sobe, a producao do dia pode subir junto dentro de uma faixa controlada;
- se houver muitas anomalias ou pico elevado, a plataforma pode exibir maior risco operacional;
- se a fase mais carregada sobe, a ocupacao de camaras ou o ritmo de processamento tambem pode subir.

Isso deixa a demo mais coerente, mesmo usando uma base originalmente de laboratorio.

## 8. Proposta de banco local sintetico

## 8.1 Tabelas recomendadas

### `daily_operations`

Objetivo:

- resumir operacao por dia.

Campos sugeridos:

- `date`
- `processed_heads`
- `processed_tons`
- `energy_cost_brl`
- `labor_cost_brl`
- `maintenance_cost_brl`
- `revenue_brl`
- `operational_status`

### `cold_chambers`

Objetivo:

- representar camaras frias.

Campos sugeridos:

- `id`
- `name`
- `occupancy_pct`
- `temperature_c`
- `target_temperature_c`
- `alert_level`

### `orders`

Objetivo:

- alimentar cards de pedidos e logistica.

Campos sugeridos:

- `id`
- `customer_name`
- `product_type`
- `planned_dispatch_at`
- `status`
- `weight_kg`
- `sla_risk`

### `maintenance_events`

Objetivo:

- alimentar timeline de manutencao e risco operacional.

Campos sugeridos:

- `id`
- `created_at`
- `sector`
- `severity`
- `status`
- `description`
- `related_sensor`

### `business_targets`

Objetivo:

- metas usadas nos cards.

Campos sugeridos:

- `period`
- `target_tons`
- `target_energy_kwh`
- `target_cost_brl`
- `target_fp`

## 8.2 Regras sugeridas para o gerador sintetico

### Produzido por dia

Base:

- usar `sum(total_kwh)` do periodo como sinal principal.

Formula sugerida:

- `processed_tons = fator_base + (kwh_total * coeficiente) + ruido_controlado`

### Faturamento

Base:

- derivar de `processed_tons`.

Formula sugerida:

- `revenue_brl = processed_tons * preco_medio_por_ton + variacao`

### Custo de energia

Base:

- vir da propria API.

Formula sugerida:

- `energy_cost_brl = total_kwh * tarifa_brl_kwh`

### Risco operacional

Base:

- combinar anomalias, pico e fator de potencia.

Formula sugerida:

- risco sobe quando:
  - `peak_kw` excede meta;
  - `avg_power_factor` cai;
  - numero de anomalias sobe.

## 9. Recomendacoes de modelagem para o app

## 9.1 Fonte principal

Usar por padrao:

- `channel = lab`

Fallbacks:

- `mock01` para demos historicas mais longas;
- `mock02` apenas para cenarios de teste ou estado vazio.

## 9.2 Granularidade de dominio

No dominio do app, separar claramente:

- camada energetica real;
- camada de negocio sintetica;
- camada de apresentacao do frigorifico.

Sugestao:

- nao renomear os campos da API na camada de integracao;
- criar DTOs ou view models mais amigaveis para a UI.

## 9.3 Mobile-first/PWA

Como o professor exigiu apresentacao via celular, a primeira versao da dashboard deveria priorizar:

- 4 a 6 cards principais no topo;
- 1 grafico grande por tela;
- listas curtas e acionaveis;
- filtros simples de periodo;
- estado offline com cache do ultimo snapshot;
- atualizacao incremental de dados, nao recarga bruta da base toda.

## 10. Backlog tecnico recomendado

## Fase 1

- integrar leitura da API real;
- montar camada de servicos com filtros por periodo;
- criar adaptadores para cards e graficos;
- preparar banco local sintetico.

## Fase 2

- correlacionar dados sinteticos com energeticos;
- construir dashboards mobile-first;
- definir alertas e metas.

## Fase 3

- transformar em PWA;
- adicionar cache;
- refinar narrativa de negocio para a apresentacao.

## 11. Decisoes iniciais propostas para validacao

- usar `lab` como fonte principal;
- usar apenas janelas filtradas por tempo;
- assumir tensao nominal de `127V` para a narrativa atual da base;
- tratar `fase1/fase2/fase3` como fases eletricas, nao setores reais;
- preencher os KPIs de negocio com banco local sintetico;
- fazer os dados sinteticos reagirem aos dados energeticos reais.

## 12. Pendencias para a proxima iteracao

Quando voce enviar as telas do Figma, a proxima versao deste documento deve incluir:

- mapeamento tela por tela;
- identificacao exata de cada card;
- definicao do que vira da API, do banco local ou de regra derivada;
- contrato de dados do frontend;
- proposta de rotas e estrutura do app PWA.
