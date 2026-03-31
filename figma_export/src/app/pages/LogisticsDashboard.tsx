import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Clock,
  Package,
  TrendingDown,
  Zap,
} from "lucide-react";
import { ApiRefreshNotice } from "../components/dashboard/ApiRefreshNotice";
import { MetricCardWithChart } from "../components/dashboard/MetricCardWithChart";
import { TimeSeriesChart } from "../components/dashboard/TimeSeriesChart";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { useDashboardAutoRefresh } from "../hooks/useDashboardAutoRefresh";
import { getLogisticsDashboardData } from "../services/dashboardData";

export default function LogisticsDashboard() {
  const {
    data: dashboardData,
    error,
    isInitialLoading,
    isRefreshing,
    lastFetchedAt,
    showRefreshNotice,
  } = useDashboardAutoRefresh({
    errorMessage: "Falha ao carregar os dados logisticos.",
    loader: getLogisticsDashboardData,
    scope: "logistics",
  });

  if (!dashboardData && error) {
    return (
      <DashboardLayout variant="logistics">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      </DashboardLayout>
    );
  }

  if (!dashboardData && isInitialLoading) {
    return (
      <DashboardLayout variant="logistics">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
          Carregando dados de logistica da API...
        </div>
      </DashboardLayout>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const {
    historicalData,
    energyPrices,
    occupancyForecast,
    hourlyData,
    avgEnergy,
    peakOccupancy,
    lowEnergyHours,
    nextIdealHour,
  } = dashboardData;
  const recentData = historicalData.slice(-12);

  return (
    <DashboardLayout variant="logistics">
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {error}
          </div>
        )}

        <div>
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            Indicadores de Planejamento
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <MetricCardWithChart
              title="Consumo Medio (24h)"
              value={avgEnergy}
              unit="kW"
              icon={Zap}
              subtitle="Ultimas 24 horas"
              miniChartData={recentData.map((point) => ({
                value: point.totalEnergy,
              }))}
              miniChartDataKey="value"
              miniChartColor="#3b82f6"
              miniChartType="area"
              footer={
                <div className="text-xs text-gray-600">
                  Baseado no perfil horario real da API
                </div>
              }
              detailTitle="Consumo de Energia - Ultimas 24 Horas"
              detailContent={
                <TimeSeriesChart
                  data={historicalData}
                  lines={[
                    {
                      dataKey: "freezerEnergy",
                      name: "Congelador",
                      color: "#3b82f6",
                    },
                    {
                      dataKey: "equipmentEnergy",
                      name: "Equipamentos",
                      color: "#10b981",
                    },
                  ]}
                  yAxisLabel="kW"
                  height={350}
                />
              }
            />

            <MetricCardWithChart
              title="Pico de Ocupacao"
              value={peakOccupancy}
              unit="%"
              icon={Package}
              subtitle="Maximo nas ultimas 24h"
              miniChartData={recentData}
              miniChartDataKey="occupancy"
              miniChartColor="#f59e0b"
              miniChartType="line"
              footer={
                <div className="text-xs text-gray-600">
                  Derivada da carga eletrica por hora
                </div>
              }
              detailTitle="Ocupacao - Ultimas 24 Horas"
              detailContent={
                <TimeSeriesChart
                  data={historicalData}
                  lines={[
                    {
                      dataKey: "occupancy",
                      name: "Ocupacao",
                      color: "#f59e0b",
                    },
                  ]}
                  yAxisLabel="%"
                  height={350}
                />
              }
            />

            <MetricCardWithChart
              title="Horas Tarifa Baixa"
              value={lowEnergyHours}
              unit="h/dia"
              icon={TrendingDown}
              subtitle="Janela de menor carga"
              miniChartData={energyPrices.slice(0, 12)}
              miniChartDataKey="price"
              miniChartColor="#10b981"
              miniChartType="area"
              footer={
                <div className="text-xs text-gray-600">
                  Indice derivado do consumo por hora
                </div>
              }
              detailTitle="Indice de Carga por Horario"
              detailContent={
                <div>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={energyPrices}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#f0f0f0"
                      />
                      <XAxis
                        dataKey="hour"
                        tickFormatter={(hour) => `${hour}h`}
                        fontSize={12}
                      />
                      <YAxis
                        label={{
                          value: "Indice",
                          angle: -90,
                          position: "insideLeft",
                        }}
                        fontSize={12}
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          value.toFixed(2),
                          "Indice",
                        ]}
                        labelFormatter={(hour) => `${hour}:00`}
                      />
                      <Bar
                        dataKey="price"
                        fill="#3b82f6"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded bg-green-50 p-2 text-center">
                      <p className="font-medium text-green-600">
                        Baixa Carga
                      </p>
                      <p className="mt-1 text-green-800">
                        0,50-0,58
                      </p>
                      <p className="text-gray-600">
                        Janela mais leve
                      </p>
                    </div>
                    <div className="rounded bg-amber-50 p-2 text-center">
                      <p className="font-medium text-amber-600">
                        Media Carga
                      </p>
                      <p className="mt-1 text-amber-800">
                        0,59-0,72
                      </p>
                      <p className="text-gray-600">
                        Faixa intermediaria
                      </p>
                    </div>
                    <div className="rounded bg-red-50 p-2 text-center">
                      <p className="font-medium text-red-600">
                        Alta Carga
                      </p>
                      <p className="mt-1 text-red-800">
                        0,73-0,85
                      </p>
                      <p className="text-gray-600">
                        Horario mais carregado
                      </p>
                    </div>
                  </div>
                </div>
              }
            />

            <MetricCardWithChart
              title="Proximo Horario Ideal"
              value={nextIdealHour ?? "--"}
              unit="h"
              icon={Clock}
              subtitle="Para operacoes de alta carga"
              footer={
                <div className="text-xs text-gray-600">
                  Baseado no menor indice de carga
                </div>
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Previsao: Ocupacao vs. Indice de Carga
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={occupancyForecast}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0f0f0"
                />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(hour) => `${hour}h`}
                  fontSize={11}
                />
                <YAxis yAxisId="left" fontSize={11} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  fontSize={11}
                />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="energyPrice"
                  name="Indice"
                  fill="#fef3c7"
                  stroke="#f59e0b"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="occupancy"
                  name="Ocupacao"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Consumo vs Ocupacao (24h)
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={hourlyData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0f0f0"
                />
                <XAxis
                  dataKey="hour"
                  tickFormatter={(hour) => `${hour}h`}
                  fontSize={11}
                />
                <YAxis yAxisId="left" fontSize={11} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  fontSize={11}
                />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="energy"
                  name="Energia"
                  stroke="#3b82f6"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="occupancy"
                  name="Ocupacao"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="mb-1 text-xs font-medium text-blue-600">
              Insight - Consumo
            </p>
            <p className="text-xs text-blue-900">
              O periodo de maior carga eletrica concentra as
              operacoes mais intensas. Vale priorizar tarefas
              pesadas fora dessa janela.
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-1 text-xs font-medium text-amber-600">
              Insight - Estoque
            </p>
            <p className="text-xs text-amber-900">
              A ocupacao exibida e derivada da curva de carga. A
              melhor janela combina menor indice de carga com
              ocupacao moderada.
            </p>
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
