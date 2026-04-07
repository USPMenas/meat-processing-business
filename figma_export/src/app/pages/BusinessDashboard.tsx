import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DollarSign,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { ApiRefreshNotice } from "../components/dashboard/ApiRefreshNotice";
import { MetricCardWithChart } from "../components/dashboard/MetricCardWithChart";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { useDashboardAutoRefresh } from "../hooks/useDashboardAutoRefresh";
import {
  getBusinessDashboardData,
  getBusinessProjection,
  getBusinessVariation,
  toBusinessHourlyPattern,
} from "../services/dashboardData";

export default function BusinessDashboard() {
  const {
    data: dashboardData,
    error,
    isInitialLoading,
    isRefreshing,
    lastFetchedAt,
    showRefreshNotice,
  } = useDashboardAutoRefresh({
    errorMessage: "Falha ao carregar os dados de negocios.",
    loader: getBusinessDashboardData,
    scope: "business",
  });

  if (!dashboardData && error) {
    return (
      <DashboardLayout variant="business">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      </DashboardLayout>
    );
  }

  if (!dashboardData && isInitialLoading) {
    return (
      <DashboardLayout variant="business">
        <div className="rounded-xl border border-blue-200 bg-white p-4 text-sm text-gray-600">
          Carregando dados de negocios...
        </div>
      </DashboardLayout>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const {
    monthlyComparison,
    currentMonthData,
    historicalData,
    currentMonth,
    previousMonth,
    currentMonthLabel,
    currentDataDays,
  } = dashboardData;
  const {
    energyCostChange,
    revenueChange,
  } = getBusinessVariation(currentMonth, previousMonth);
  const {
    projectedRevenue,
    projectedEnergyCost,
    currentMargin,
    projectedMargin,
  } = getBusinessProjection(currentMonth, currentDataDays);
  const dailyChartData = currentMonthData.map((point) => ({
    day: point.day,
    energy: point.energy,
    revenue: point.revenue / 100,
  }));
  const hourlyAverages =
    toBusinessHourlyPattern(historicalData);
  const averageDailyCost =
    currentDataDays > 0
      ? currentMonth.energyCost / currentDataDays
      : 0;

  return (
    <DashboardLayout variant="business">
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {error}
          </div>
        )}

        <div>
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            Indicadores Financeiros - {currentMonthLabel}
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
            <MetricCardWithChart
              title="Faturamento Atual"
              value={`R$ ${(currentMonth.revenue / 1000).toFixed(0)}k`}
              icon={DollarSign}
              variant="business"
              subtitle="Periodo com dados"
              footer={
                <div className="text-xs text-blue-700">
                  <strong>vs. ultimo periodo com dados:</strong>{" "}
                  {revenueChange >= 0 ? "+" : ""}
                  {revenueChange.toFixed(1)}%
                </div>
              }
            />

            <MetricCardWithChart
              title="Projecao Mensal"
              value={`R$ ${(projectedRevenue / 1000).toFixed(0)}k`}
              icon={TrendingUp}
              variant="business"
              subtitle="Estimativa fim do mes"
              footer={
                <div className="text-xs text-blue-700">
                  Baseado em {currentDataDays} dias com leitura
                </div>
              }
            />

            <MetricCardWithChart
              title="Custo Energetico"
              value={`R$ ${(currentMonth.energyCost / 1000).toFixed(0)}k`}
              icon={Zap}
              variant="business"
              subtitle="Periodo atual"
              footer={
                <div className="text-xs text-blue-700">
                  <strong>Projecao mes:</strong> R${" "}
                  {(projectedEnergyCost / 1000).toFixed(0)}k
                </div>
              }
            />

            <MetricCardWithChart
              title="Projecao de Custo Mensal"
              value={`R$ ${(projectedEnergyCost / 1000).toFixed(0)}k`}
              icon={TrendingUp}
              variant="business"
              subtitle="Estimativa fim do mes"
              footer={
                <div className="text-xs text-blue-700">
                  Baseado em {currentDataDays} dias com leitura
                </div>
              }
              detailTitle="Comparacao Mensal - Periodos Disponiveis na API"
              detailContent={
                <div>
                  <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={monthlyComparison}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e0e7ff"
                      />
                      <XAxis
                        dataKey="month"
                        fontSize={12}
                        stroke="#64748b"
                      />
                      <YAxis
                        yAxisId="left"
                        fontSize={12}
                        stroke="#64748b"
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        fontSize={12}
                        stroke="#64748b"
                      />
                      <Tooltip
                        formatter={(value: number) =>
                          `R$ ${value.toLocaleString("pt-BR")}`
                        }
                      />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="energyCost"
                        name="Custo"
                        fill="#3b82f6"
                        radius={[8, 8, 0, 0]}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="revenue"
                        name="Faturamento"
                        stroke="#10b981"
                        strokeWidth={3}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Custo Energetico Diario - Dias com Leitura
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={dailyChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e0e7ff"
                />
                <XAxis
                  dataKey="day"
                  label={{
                    value: "Dia do Mes",
                    position: "insideBottomLeft",
                    offset: -5,
                  }}
                  fontSize={11}
                  stroke="#64748b"
                />
                <YAxis
                  label={{
                    value: "Consumo (R$)",
                    position: "insideBottomLeft",
                    offset: 20,
                    angle: -90,
                  }}
                  fontSize={11}
                  stroke="#64748b"
                />
                <Tooltip
                  formatter={(value: number) =>
                    `R$ ${value.toFixed(0)}`
                  }
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line
                  type="monotone"
                  dataKey="energy"
                  name="Custo de Energia"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-3">
              <p className="text-xs text-blue-800">
                <strong>Total do periodo:</strong> R${" "}
                {currentMonth.energyCost.toLocaleString("pt-BR")} |
                <strong> Media diaria:</strong> R${" "}
                {averageDailyCost.toFixed(0)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">
              Padrao Diario: Consumo vs Ocupacao
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={hourlyAverages}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e0e7ff"
                />
                <XAxis
                  dataKey="hour"
                  label={{
                    value: "Hora do Dia",
                    position: "insideBottomLeft",
                    offset: -5,
                  }}
                  fontSize={11}
                  stroke="#64748b"
                />
                <YAxis
                  yAxisId="left"
                  label={{
                    value: "Energia (kW)",
                    angle: -90,
                    position: "insideLeft",
                  }}
                  fontSize={11}
                  stroke="#64748b"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  label={{
                    value: "Ocupacao (%)",
                    angle: 90,
                    position: "insideRight",
                  }}
                  fontSize={11}
                  stroke="#64748b"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="avgEnergy"
                  name="Consumo Medio (kW)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 3 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgOccupancy"
                  name="Ocupacao Media (%)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: "#f59e0b", r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="mt-4 rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-3">
              <p className="text-xs text-amber-800">
                <strong>Insight:</strong> O padrao diario usa o
                perfil horario real da API e uma ocupacao derivada
                diretamente dessa curva.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            Insights Executivos
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-blue-100 bg-white p-3">
              <div className="flex items-start gap-2">
                <div className="rounded-lg bg-green-100 p-1.5">
                  <TrendingUp className="size-4 text-green-700" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-900">
                    Crescimento Sustentavel
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    A receita derivada cresceu{" "}
                    {revenueChange.toFixed(1)}% enquanto custo
                    energetico variou {energyCostChange.toFixed(1)}
                    %.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-white p-3">
              <div className="flex items-start gap-2">
                <div className="rounded-lg bg-purple-100 p-1.5">
                  <DollarSign className="size-4 text-purple-700" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-900">
                    Leitura de Negocio
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    Todos os indicadores financeiros desta tela
                    estao ancorados no consumo energetico real da
                    API, com multiplicadores fixos para
                    demonstracao.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ApiRefreshNotice
          isRefreshing={isRefreshing}
          lastFetchedAt={lastFetchedAt}
          visible={showRefreshNotice}
        />
      </div>
    </DashboardLayout>
  );
}
