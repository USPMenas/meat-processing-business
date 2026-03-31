import {
  Package,
  Snowflake,
  Thermometer,
  Zap,
} from "lucide-react";
import { AlertBanner } from "../components/dashboard/AlertBanner";
import { ApiRefreshNotice } from "../components/dashboard/ApiRefreshNotice";
import { MetricCardWithChart } from "../components/dashboard/MetricCardWithChart";
import { TimeSeriesChart } from "../components/dashboard/TimeSeriesChart";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { useDashboardAutoRefresh } from "../hooks/useDashboardAutoRefresh";
import { getOperationalDashboardData } from "../services/dashboardData";

export default function OperationalDashboard() {
  const {
    data: dashboardData,
    error,
    isInitialLoading,
    isRefreshing,
    lastFetchedAt,
    showRefreshNotice,
  } = useDashboardAutoRefresh({
    errorMessage: "Falha ao carregar os dados operacionais.",
    loader: getOperationalDashboardData,
    scope: "operational",
  });

  if (!dashboardData && error) {
    return (
      <DashboardLayout variant="operational">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      </DashboardLayout>
    );
  }

  if (!dashboardData && isInitialLoading) {
    return (
      <DashboardLayout variant="operational">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
          Carregando dados operacionais da API...
        </div>
      </DashboardLayout>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const {
    currentData,
    historicalData,
    predictionData,
    alerts,
  } = dashboardData;
  const combinedData = [
    ...historicalData.map((point) => ({
      ...point,
      type: "historico",
    })),
    ...predictionData.map((point) => ({
      ...point,
      type: "previsao",
    })),
  ];
  const recentData = historicalData.slice(-12);
  const averageFreezerEnergy =
    historicalData.reduce(
      (sum, point) => sum + point.freezerEnergy,
      0,
    ) / historicalData.length;
  const averageEquipmentEnergy =
    historicalData.reduce(
      (sum, point) => sum + point.equipmentEnergy,
      0,
    ) / historicalData.length;
  const averageTemperature =
    historicalData.reduce(
      (sum, point) => sum + point.temperature,
      0,
    ) / historicalData.length;
  const averageOccupancy =
    historicalData.reduce(
      (sum, point) => sum + point.occupancy,
      0,
    ) / historicalData.length;

  return (
    <DashboardLayout variant="operational">
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            {error}
          </div>
        )}

        {alerts.length > 0 && <AlertBanner alerts={alerts} />}

        <div>
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            Monitoramento em Tempo Real
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <MetricCardWithChart
              title="Energia - Congelador"
              value={currentData.freezerEnergy}
              unit="kW"
              icon={Zap}
              status={
                currentData.freezerEnergy >
                averageFreezerEnergy * 1.08
                  ? "warning"
                  : "normal"
              }
              subtitle="Carga principal derivada da fase 1"
              miniChartData={recentData}
              miniChartDataKey="freezerEnergy"
              miniChartColor="#3b82f6"
              miniChartType="area"
              footer={
                <div className="text-xs text-gray-600">
                  <strong>Media (1h):</strong>{" "}
                  {averageFreezerEnergy.toFixed(1)} kW
                </div>
              }
              detailTitle="Energia do Congelador - Detalhes"
              detailContent={
                <div>
                  <TimeSeriesChart
                    data={combinedData}
                    lines={[
                      {
                        dataKey: "freezerEnergy",
                        name: "Congelador",
                        color: "#3b82f6",
                      },
                    ]}
                    yAxisLabel="kW"
                    height={350}
                  />
                  <div className="mt-4 rounded-lg bg-blue-50 p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Base real:</strong> fase 1 do canal
                      `lab`, agregada minuto a minuto.
                    </p>
                  </div>
                </div>
              }
            />

            <MetricCardWithChart
              title="Energia - Equipamentos"
              value={currentData.equipmentEnergy}
              unit="kW"
              icon={Snowflake}
              status={
                currentData.equipmentEnergy >
                averageEquipmentEnergy * 1.1
                  ? "warning"
                  : "normal"
              }
              subtitle="Soma das fases 2 e 3"
              miniChartData={recentData}
              miniChartDataKey="equipmentEnergy"
              miniChartColor="#10b981"
              miniChartType="area"
              footer={
                <div className="text-xs text-gray-600">
                  <strong>Media (1h):</strong>{" "}
                  {averageEquipmentEnergy.toFixed(1)} kW
                </div>
              }
              detailTitle="Energia dos Equipamentos - Detalhes"
              detailContent={
                <div>
                  <TimeSeriesChart
                    data={combinedData}
                    lines={[
                      {
                        dataKey: "equipmentEnergy",
                        name: "Equipamentos",
                        color: "#10b981",
                      },
                    ]}
                    yAxisLabel="kW"
                    height={350}
                  />
                  <div className="mt-4 rounded-lg bg-green-50 p-3">
                    <p className="text-sm text-green-800">
                      <strong>Base real:</strong> soma das fases 2
                      e 3 do canal `lab`.
                    </p>
                  </div>
                </div>
              }
            />

            <MetricCardWithChart
              title="Temperatura"
              value={currentData.temperature}
              unit="°C"
              icon={Thermometer}
              status={
                currentData.temperature > -16
                  ? "critical"
                  : currentData.temperature < -20
                    ? "warning"
                    : "normal"
              }
              subtitle="Indicador derivado de tensao e FP"
              miniChartData={recentData}
              miniChartDataKey="temperature"
              miniChartColor="#8b5cf6"
              miniChartType="line"
              footer={
                <div className="text-xs text-gray-600">
                  <strong>Media visual:</strong>{" "}
                  {averageTemperature.toFixed(2)} °C
                </div>
              }
              detailTitle="Temperatura Derivada - Detalhes"
              detailContent={
                <div>
                  <TimeSeriesChart
                    data={combinedData}
                    lines={[
                      {
                        dataKey: "temperature",
                        name: "Temperatura",
                        color: "#8b5cf6",
                      },
                    ]}
                    yAxisLabel="°C"
                    height={350}
                  />
                  <div className="mt-4 rounded-lg bg-purple-50 p-3">
                    <p className="text-sm text-purple-800">
                      <strong>Leitura derivada:</strong> a tela
                      reaproveita tensao e fator de potencia para
                      simular a faixa termica do frigorifico.
                    </p>
                  </div>
                </div>
              }
            />

            <MetricCardWithChart
              title="Ocupacao"
              value={currentData.occupancy}
              unit="%"
              icon={Package}
              status={
                currentData.occupancy > 85
                  ? "warning"
                  : "normal"
              }
              subtitle="Indice derivado da carga total"
              miniChartData={recentData}
              miniChartDataKey="occupancy"
              miniChartColor="#f59e0b"
              miniChartType="area"
              footer={
                <div className="text-xs text-gray-600">
                  <strong>Media (1h):</strong>{" "}
                  {averageOccupancy.toFixed(1)}%
                </div>
              }
              detailTitle="Ocupacao Derivada - Detalhes"
              detailContent={
                <div>
                  <TimeSeriesChart
                    data={combinedData}
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
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-amber-50 p-3">
                      <p className="text-sm text-amber-800">
                        <strong>Faixa visual:</strong> 60-80%
                      </p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3">
                      <p className="text-sm text-amber-800">
                        <strong>Base:</strong> energia total
                        normalizada na ultima hora.
                      </p>
                    </div>
                  </div>
                </div>
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Consumo Total de Energia
            </h3>
            <TimeSeriesChart
              data={combinedData}
              lines={[
                {
                  dataKey: "totalEnergy",
                  name: "Total",
                  color: "#06b6d4",
                },
              ]}
              yAxisLabel="kW"
              height={200}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Comparativo: Energia vs Temperatura
            </h3>
            <TimeSeriesChart
              data={combinedData}
              lines={[
                {
                  dataKey: "totalEnergy",
                  name: "Energia",
                  color: "#3b82f6",
                },
                {
                  dataKey: "temperature",
                  name: "Temperatura",
                  color: "#8b5cf6",
                },
              ]}
              height={200}
            />
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
