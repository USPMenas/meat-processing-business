import {
  addHours,
  addMinutes,
  eachDayOfInterval,
  endOfDay,
  format,
  getDaysInMonth,
  startOfDay,
  startOfMonth,
  subHours,
  subMinutes,
} from "date-fns";

const API_BASE = (
  import.meta.env.VITE_TCC_API_BASE ?? "/api"
).replace(/\/$/, "");
const DEFAULT_CHANNEL =
  import.meta.env.VITE_TCC_CHANNEL ?? "lab";
const DATASET_NOW = new Date(
  import.meta.env.VITE_TCC_DATASET_NOW ??
    "2026-03-31T10:43:04",
);
const NOMINAL_VOLTAGE = Number(
  import.meta.env.VITE_TCC_NOMINAL_VOLTAGE ?? 127,
);
const VOLTAGE_LOWER_LIMIT = Number(
  import.meta.env.VITE_TCC_VOLTAGE_LOWER_LIMIT ?? 117,
);
const VOLTAGE_UPPER_LIMIT = Number(
  import.meta.env.VITE_TCC_VOLTAGE_UPPER_LIMIT ?? 133,
);
const ENERGY_COST_RATE = Number(
  import.meta.env.VITE_TCC_ENERGY_COST_RATE ?? 5.45,
);
const REVENUE_MULTIPLIER = Number(
  import.meta.env.VITE_TCC_REVENUE_MULTIPLIER ?? 8.2,
);

type Sensor = "fase1" | "fase2" | "fase3";

interface Measurement {
  channel: string;
  sensor: string;
  apparent_power: number;
  active_power: number;
  reactive_power: number;
  power_factor: number;
  current: number;
  voltage: number;
  timestamp: string;
}

interface MeasurementsResponse {
  channel: string;
  from: string;
  to: string;
  count: number;
  measurements: Measurement[];
}

interface ConsumptionResult {
  sensor: string;
  total_kwh: number;
  min_demand_kw: number;
  max_demand_kw: number;
}

interface ConsumptionResponse {
  channel: string;
  from: string;
  to: string;
  results: ConsumptionResult[];
}

interface ElectricalHealthResult {
  sensor: string;
  avg_voltage: number;
  avg_power_factor: number;
}

interface ElectricalHealthResponse {
  channel: string;
  from: string;
  to: string;
  results: ElectricalHealthResult[];
}

interface DemandPeakResult {
  sensor: string;
  peak_kw: number;
  timestamp: string;
}

interface DemandPeaksResponse {
  channel: string;
  from: string;
  to: string;
  results: DemandPeakResult[];
}

interface HourlyProfileResult {
  hour: string;
  sensor: string;
  avg_power_kw: number;
}

interface HourlyProfileResponse {
  channel: string;
  from: string;
  to: string;
  results: HourlyProfileResult[];
}

interface VoltageAnomalyResult {
  timestamp: string;
  sensor: string;
  voltage: number;
  anomaly_type: string;
  deviation_pct: number;
}

interface VoltageAnomaliesResponse {
  channel: string;
  from: string;
  to: string;
  lower_limit: number;
  upper_limit: number;
  nominal_voltage: number;
  results: VoltageAnomalyResult[];
}

export interface Alert {
  type: "warning" | "critical" | "info";
  variable: string;
  message: string;
  value: number;
  expected: number;
}

export interface OperationalPoint {
  timestamp: Date;
  freezerEnergy: number;
  equipmentEnergy: number;
  totalEnergy: number;
  temperature: number;
  occupancy: number;
  avgVoltage: number;
  avgPowerFactor: number;
}

export interface OperationalDashboardData {
  currentData: OperationalPoint;
  historicalData: OperationalPoint[];
  predictionData: OperationalPoint[];
  alerts: Alert[];
  updatedAt: Date;
}

export interface EnergyPricePoint {
  hour: number;
  price: number;
}

export interface LogisticsForecastPoint {
  hour: number;
  occupancy: number;
  energyPrice: number;
}

export interface LogisticsChartPoint {
  hour: number;
  energy: number;
  occupancy: number;
  price: number;
}

export interface LogisticsDashboardData {
  historicalData: OperationalPoint[];
  energyPrices: EnergyPricePoint[];
  occupancyForecast: LogisticsForecastPoint[];
  hourlyData: LogisticsChartPoint[];
  avgEnergy: number;
  peakOccupancy: number;
  lowEnergyHours: number;
  nextIdealHour: number | null;
  updatedAt: Date;
}

export interface MonthlyComparisonPoint {
  month: string;
  energyCost: number;
  revenue: number;
}

export interface DailyBusinessPoint {
  day: number;
  energy: number;
  revenue: number;
}

export interface BusinessDashboardData {
  monthlyComparison: MonthlyComparisonPoint[];
  currentMonthData: DailyBusinessPoint[];
  historicalData: OperationalPoint[];
  currentMonth: MonthlyComparisonPoint;
  previousMonth: MonthlyComparisonPoint;
  currentMonthLabel: string;
  currentDataDays: number;
  updatedAt: Date;
}

type SensorMap = Record<Sensor, number>;

function clamp(
  value: number,
  minValue: number,
  maxValue: number,
) {
  return Math.min(Math.max(value, minValue), maxValue);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

function normalize(
  value: number,
  inputMin: number,
  inputMax: number,
  outputMin: number,
  outputMax: number,
) {
  if (inputMax - inputMin === 0) {
    return (outputMin + outputMax) / 2;
  }

  const ratio = (value - inputMin) / (inputMax - inputMin);
  return outputMin + ratio * (outputMax - outputMin);
}

function formatApiDate(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm:ss");
}

function formatMonthLabel(date: Date) {
  const value = format(date, "MMM/yy");
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function hourLabel(hour: number) {
  return `${hour}h`;
}

function loadToTemperature(
  voltage: number,
  powerFactor: number,
) {
  const voltageDriven = normalize(
    voltage,
    124,
    131.5,
    -20.1,
    -17.0,
  );
  const factorPenalty = normalize(
    powerFactor,
    0.2,
    1,
    0.8,
    -0.2,
  );

  return clamp(voltageDriven + factorPenalty, -20.5, -16.2);
}

function loadToOccupancy(
  totalEnergy: number,
  hour: number,
  minEnergy: number,
  maxEnergy: number,
) {
  const energyDriven = normalize(
    totalEnergy,
    minEnergy,
    maxEnergy,
    52,
    84,
  );

  const hourAdjustment =
    hour >= 7 && hour <= 18
      ? 4
      : hour >= 19 && hour <= 22
        ? -2
        : -7;

  return clamp(energyDriven + hourAdjustment, 45, 92);
}

function measurementsByMinute(
  measurements: Measurement[],
) {
  const buckets = new Map<
    string,
    {
      timestamp: Date;
      sensors: Record<
        Sensor,
        {
          activePower: number[];
          voltage: number[];
          powerFactor: number[];
        }
      >;
    }
  >();

  const safeSensor = (sensor: string) =>
    sensor === "fase1" ||
    sensor === "fase2" ||
    sensor === "fase3";

  measurements.forEach((measurement) => {
    if (!safeSensor(measurement.sensor)) return;

    const timestamp = new Date(measurement.timestamp);
    const minuteKey = format(
      timestamp,
      "yyyy-MM-dd'T'HH:mm",
    );

    if (!buckets.has(minuteKey)) {
      buckets.set(minuteKey, {
        timestamp: new Date(`${minuteKey}:00`),
        sensors: {
          fase1: {
            activePower: [],
            voltage: [],
            powerFactor: [],
          },
          fase2: {
            activePower: [],
            voltage: [],
            powerFactor: [],
          },
          fase3: {
            activePower: [],
            voltage: [],
            powerFactor: [],
          },
        },
      });
    }

    const bucket = buckets.get(minuteKey)!;
    const sensorBucket = bucket.sensors[
      measurement.sensor as Sensor
    ];
    sensorBucket.activePower.push(measurement.active_power);
    sensorBucket.voltage.push(measurement.voltage);
    sensorBucket.powerFactor.push(measurement.power_factor);
  });

  const basePoints = Array.from(buckets.values())
    .sort(
      (left, right) =>
        left.timestamp.getTime() - right.timestamp.getTime(),
    )
    .map((bucket) => {
      const phase1 = average(
        bucket.sensors.fase1.activePower,
      );
      const phase2 = average(
        bucket.sensors.fase2.activePower,
      );
      const phase3 = average(
        bucket.sensors.fase3.activePower,
      );
      const totalEnergy = phase1 + phase2 + phase3;
      const avgVoltage = average([
        average(bucket.sensors.fase1.voltage),
        average(bucket.sensors.fase2.voltage),
        average(bucket.sensors.fase3.voltage),
      ]);
      const avgPowerFactor = average([
        average(bucket.sensors.fase1.powerFactor),
        average(bucket.sensors.fase2.powerFactor),
        average(bucket.sensors.fase3.powerFactor),
      ]);

      return {
        timestamp: bucket.timestamp,
        freezerEnergy: phase1,
        equipmentEnergy: phase2 + phase3,
        totalEnergy,
        avgVoltage,
        avgPowerFactor,
      };
    });

  const totals = basePoints.map((point) => point.totalEnergy);
  const minEnergy = Math.min(...totals);
  const maxEnergy = Math.max(...totals);

  return basePoints.map((point) => ({
    ...point,
    temperature: loadToTemperature(
      point.avgVoltage,
      point.avgPowerFactor,
    ),
    occupancy: loadToOccupancy(
      point.totalEnergy,
      point.timestamp.getHours(),
      minEnergy,
      maxEnergy,
    ),
  }));
}

function averageDiff(values: number[]) {
  if (values.length < 2) return 0;

  const diffs = values
    .slice(1)
    .map((value, index) => value - values[index]);

  return average(diffs);
}

function buildForecast(
  history: OperationalPoint[],
) {
  if (history.length === 0) return [];

  const lastPoint = history[history.length - 1];
  const lastWindow = history.slice(-12);
  const freezerTrend = averageDiff(
    lastWindow.map((point) => point.freezerEnergy),
  );
  const equipmentTrend = averageDiff(
    lastWindow.map((point) => point.equipmentEnergy),
  );
  const totals = history.map((point) => point.totalEnergy);
  const minEnergy = Math.min(...totals);
  const maxEnergy = Math.max(...totals);

  return Array.from({ length: 60 }, (_, index) => {
    const step = index + 1;
    const timestamp = addMinutes(lastPoint.timestamp, step);
    const freezerEnergy = clamp(
      lastPoint.freezerEnergy +
        freezerTrend * step * 0.35 +
        Math.sin(step / 7) * 0.35,
      lastPoint.freezerEnergy * 0.82,
      lastPoint.freezerEnergy * 1.18,
    );
    const equipmentEnergy = clamp(
      lastPoint.equipmentEnergy +
        equipmentTrend * step * 0.35 +
        Math.cos(step / 9) * 0.28,
      lastPoint.equipmentEnergy * 0.82,
      lastPoint.equipmentEnergy * 1.18,
    );
    const totalEnergy = freezerEnergy + equipmentEnergy;
    const avgVoltage =
      lastPoint.avgVoltage + Math.sin(step / 11) * 0.4;
    const avgPowerFactor = clamp(
      lastPoint.avgPowerFactor + Math.cos(step / 13) * 0.015,
      0.2,
      0.99,
    );

    return {
      timestamp,
      freezerEnergy,
      equipmentEnergy,
      totalEnergy,
      avgVoltage,
      avgPowerFactor,
      temperature: loadToTemperature(
        avgVoltage,
        avgPowerFactor,
      ),
      occupancy: loadToOccupancy(
        totalEnergy,
        timestamp.getHours(),
        minEnergy,
        maxEnergy,
      ),
    };
  });
}

function pivotHourlyProfile(
  results: HourlyProfileResult[],
) {
  const hourMap = new Map<number, SensorMap>();

  results.forEach((result) => {
    const hour = Number(result.hour);

    if (!hourMap.has(hour)) {
      hourMap.set(hour, {
        fase1: 0,
        fase2: 0,
        fase3: 0,
      });
    }

    if (
      result.sensor === "fase1" ||
      result.sensor === "fase2" ||
      result.sensor === "fase3"
    ) {
      hourMap.get(hour)![result.sensor] =
        result.avg_power_kw;
    }
  });

  const totals = Array.from(hourMap.values()).map(
    (point) => point.fase1 + point.fase2 + point.fase3,
  );
  const minEnergy = Math.min(...totals);
  const maxEnergy = Math.max(...totals);

  return Array.from(hourMap.entries())
    .sort(([left], [right]) => left - right)
    .map(([hour, sensors]) => {
      const totalEnergy =
        sensors.fase1 + sensors.fase2 + sensors.fase3;
      const occupancy = loadToOccupancy(
        totalEnergy,
        hour,
        minEnergy,
        maxEnergy,
      );

      return {
        hour,
        timestamp: new Date(
          `2026-03-31T${String(hour).padStart(2, "0")}:00:00`,
        ),
        freezerEnergy: sensors.fase1,
        equipmentEnergy: sensors.fase2 + sensors.fase3,
        totalEnergy,
        occupancy,
      };
    });
}

function buildLoadIndex(
  hourlyData: ReturnType<typeof pivotHourlyProfile>,
) {
  const totals = hourlyData.map((point) => point.totalEnergy);
  const minEnergy = Math.min(...totals);
  const maxEnergy = Math.max(...totals);

  return hourlyData.map((point) => ({
    hour: point.hour,
    price: Number(
      normalize(
        point.totalEnergy,
        minEnergy,
        maxEnergy,
        0.5,
        0.85,
      ).toFixed(2),
    ),
  }));
}

function rotateByReferenceHour<T>(
  values: T[],
  referenceHour: number,
) {
  const offset = referenceHour % values.length;
  return values
    .slice(offset)
    .concat(values.slice(0, offset));
}

function buildOccupancyForecast(
  hourlyData: ReturnType<typeof pivotHourlyProfile>,
  loadIndex: EnergyPricePoint[],
) {
  const rotatedHours = rotateByReferenceHour(
    hourlyData,
    DATASET_NOW.getHours(),
  );
  const rotatedPrices = rotateByReferenceHour(
    loadIndex,
    DATASET_NOW.getHours(),
  );

  return rotatedHours.map((point, index) => ({
    hour:
      (DATASET_NOW.getHours() + index) %
      rotatedHours.length,
    occupancy: Number(point.occupancy.toFixed(1)),
    energyPrice: rotatedPrices[index].price,
  }));
}

function nextIdealHour(
  prices: EnergyPricePoint[],
  forecast: LogisticsForecastPoint[],
) {
  const currentHour = DATASET_NOW.getHours();

  const nextWindow = forecast
    .filter(
      (point) =>
        point.hour !== currentHour &&
        point.occupancy <= 68,
    )
    .sort((left, right) => {
      if (left.energyPrice === right.energyPrice) {
        return left.occupancy - right.occupancy;
      }

      return left.energyPrice - right.energyPrice;
    });

  return nextWindow[0]?.hour ?? prices[0]?.hour ?? null;
}

function alertByPowerFactor(
  result: ElectricalHealthResult,
) {
  const value = result.avg_power_factor * 100;

  if (result.avg_power_factor < 0.6) {
    return {
      type: "critical" as const,
      variable: `Fator de Potencia - ${result.sensor}`,
      message: "Muito abaixo do ideal",
      value,
      expected: 92,
    };
  }

  if (result.avg_power_factor < 0.85) {
    return {
      type: "warning" as const,
      variable: `Fator de Potencia - ${result.sensor}`,
      message: "Abaixo do ideal",
      value,
      expected: 92,
    };
  }

  return null;
}

function buildAlerts(
  health: ElectricalHealthResponse,
  peaks: DemandPeaksResponse,
  anomalies: VoltageAnomaliesResponse,
) {
  const alerts: Alert[] = [];

  health.results.forEach((result) => {
    const powerFactorAlert = alertByPowerFactor(result);

    if (powerFactorAlert) {
      alerts.push(powerFactorAlert);
    }
  });

  const anomalyCount = anomalies.results.length;

  if (anomalyCount > 0) {
    alerts.push({
      type: anomalyCount > 10 ? "warning" : "info",
      variable: "Tensao",
      message:
        "Ocorrencias fora da faixa nas ultimas 24h",
      value: anomalyCount,
      expected: 0,
    });
  }

  const peak = peaks.results.reduce(
    (highest, result) =>
      result.peak_kw > highest.peak_kw ? result : highest,
    peaks.results[0],
  );

  if (peak && peak.peak_kw > 20) {
    alerts.push({
      type: "warning",
      variable: `Pico de Demanda - ${peak.sensor}`,
      message: "Carga elevada no periodo recente",
      value: peak.peak_kw,
      expected: 20,
    });
  }

  return alerts.slice(0, 3);
}

function totalKwhFromConsumption(
  response: ConsumptionResponse,
) {
  return response.results.reduce(
    (sum, result) => sum + result.total_kwh,
    0,
  );
}

function energyToRevenue(energyCost: number) {
  return energyCost * REVENUE_MULTIPLIER;
}

function summaryFromConsumption(
  label: string,
  response: ConsumptionResponse,
) {
  const totalKwh = totalKwhFromConsumption(response);
  const energyCost = totalKwh * ENERGY_COST_RATE;

  return {
    month: label,
    energyCost,
    revenue: energyToRevenue(energyCost),
  };
}

async function apiGet<T>(
  pathName: string,
  params?: Record<string, string | number | undefined>,
) {
  const url = new URL(
    `${API_BASE}/${pathName.replace(/^\/+/, "")}`,
    window.location.origin,
  );

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined) return;
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `Falha ao consultar a API (${response.status})`,
    );
  }

  return (await response.json()) as T;
}

async function fetchMeasurements(
  channel: string,
  from: Date,
  to: Date,
) {
  return apiGet<MeasurementsResponse>(channel, {
    from_time: formatApiDate(from),
    to_time: formatApiDate(to),
  });
}

async function fetchConsumption(
  channel: string,
  from: Date,
  to: Date,
) {
  return apiGet<ConsumptionResponse>(
    `analytics/${channel}/consumption`,
    {
      from_time: formatApiDate(from),
      to_time: formatApiDate(to),
    },
  );
}

async function fetchElectricalHealth(
  channel: string,
  from: Date,
  to: Date,
) {
  return apiGet<ElectricalHealthResponse>(
    `analytics/${channel}/electrical_health`,
    {
      from_time: formatApiDate(from),
      to_time: formatApiDate(to),
    },
  );
}

async function fetchDemandPeaks(
  channel: string,
  from: Date,
  to: Date,
) {
  return apiGet<DemandPeaksResponse>(
    `analytics/${channel}/demand_peaks`,
    {
      from_time: formatApiDate(from),
      to_time: formatApiDate(to),
    },
  );
}

async function fetchHourlyProfile(
  channel: string,
  from: Date,
  to: Date,
) {
  return apiGet<HourlyProfileResponse>(
    `analytics/${channel}/hourly_profile`,
    {
      from_time: formatApiDate(from),
      to_time: formatApiDate(to),
    },
  );
}

async function fetchVoltageAnomalies(
  channel: string,
  from: Date,
  to: Date,
) {
  return apiGet<VoltageAnomaliesResponse>(
    `analytics/${channel}/voltage_anomalies`,
    {
      from_time: formatApiDate(from),
      to_time: formatApiDate(to),
      lower_limit: VOLTAGE_LOWER_LIMIT,
      upper_limit: VOLTAGE_UPPER_LIMIT,
      nominal_voltage: NOMINAL_VOLTAGE,
    },
  );
}

export async function getOperationalDashboardData(
  channel = DEFAULT_CHANNEL,
): Promise<OperationalDashboardData> {
  const historyStart = subMinutes(DATASET_NOW, 60);
  const alertStart = subHours(DATASET_NOW, 24);

  const [measurements, health, peaks, anomalies] =
    await Promise.all([
      fetchMeasurements(channel, historyStart, DATASET_NOW),
      fetchElectricalHealth(channel, historyStart, DATASET_NOW),
      fetchDemandPeaks(channel, alertStart, DATASET_NOW),
      fetchVoltageAnomalies(
        channel,
        alertStart,
        DATASET_NOW,
      ),
    ]);

  const historicalData = measurementsByMinute(
    measurements.measurements,
  );
  const predictionData = buildForecast(historicalData);
  const currentData =
    historicalData[historicalData.length - 1];

  if (!currentData) {
    throw new Error("Sem dados operacionais disponiveis.");
  }

  return {
    currentData,
    historicalData,
    predictionData,
    alerts: buildAlerts(health, peaks, anomalies),
    updatedAt: DATASET_NOW,
  };
}

export async function getLogisticsDashboardData(
  channel = DEFAULT_CHANNEL,
): Promise<LogisticsDashboardData> {
  const from = subHours(DATASET_NOW, 24);
  const profile = await fetchHourlyProfile(
    channel,
    from,
    DATASET_NOW,
  );

  const hourlyProfile = pivotHourlyProfile(profile.results);
  const energyPrices = buildLoadIndex(hourlyProfile);
  const occupancyForecast = buildOccupancyForecast(
    hourlyProfile,
    energyPrices,
  );
  const hourlyData = hourlyProfile.map((point) => ({
    hour: point.hour,
    energy: Number(point.totalEnergy.toFixed(1)),
    occupancy: Number(point.occupancy.toFixed(1)),
    price:
      energyPrices.find(
        (entry) => entry.hour === point.hour,
      )?.price ?? 0,
  }));

  return {
    historicalData: hourlyProfile.map((point) => ({
      timestamp: point.timestamp,
      freezerEnergy: point.freezerEnergy,
      equipmentEnergy: point.equipmentEnergy,
      totalEnergy: point.totalEnergy,
      occupancy: point.occupancy,
      temperature: loadToTemperature(
        NOMINAL_VOLTAGE,
        0.9,
      ),
      avgVoltage: NOMINAL_VOLTAGE,
      avgPowerFactor: 0.9,
    })),
    energyPrices,
    occupancyForecast,
    hourlyData,
    avgEnergy: Number(
      average(
        hourlyProfile.map((point) => point.totalEnergy),
      ).toFixed(1),
    ),
    peakOccupancy: Number(
      Math.max(
        ...hourlyProfile.map((point) => point.occupancy),
      ).toFixed(1),
    ),
    lowEnergyHours: energyPrices.filter(
      (point) => point.price <= 0.58,
    ).length,
    nextIdealHour: nextIdealHour(
      energyPrices,
      occupancyForecast,
    ),
    updatedAt: DATASET_NOW,
  };
}

export async function getBusinessDashboardData(
  channel = DEFAULT_CHANNEL,
): Promise<BusinessDashboardData> {
  const monthStart = startOfMonth(DATASET_NOW);
  const monthDays = eachDayOfInterval({
    start: monthStart,
    end: startOfDay(DATASET_NOW),
  });

  const dailyResponses = await Promise.all(
    monthDays.map((day) =>
      fetchConsumption(
        channel,
        startOfDay(day),
        format(day, "yyyy-MM-dd") ===
          format(DATASET_NOW, "yyyy-MM-dd")
          ? DATASET_NOW
          : endOfDay(day),
      ),
    ),
  );

  const currentMonthData = dailyResponses
    .map((response, index) => {
      const totalKwh = totalKwhFromConsumption(response);
      const energyCost = totalKwh * ENERGY_COST_RATE;

      return {
        day: monthDays[index].getDate(),
        energy: Number(energyCost.toFixed(0)),
        revenue: Number(
          energyToRevenue(energyCost).toFixed(0),
        ),
      };
    })
    .filter((point) => point.energy > 0);

  const comparisonPeriods = [
    {
      label: "Out/25",
      channel: "mock01",
      from: new Date("2025-10-01T00:00:00"),
      to: new Date("2025-10-31T23:59:59"),
    },
    {
      label: "Nov/25",
      channel: "mock01",
      from: new Date("2025-11-01T00:00:00"),
      to: new Date("2025-11-30T23:59:59"),
    },
    {
      label: "Dez/25",
      channel,
      from: new Date("2025-12-01T00:00:00"),
      to: new Date("2025-12-31T23:59:59"),
    },
    {
      label: formatMonthLabel(DATASET_NOW),
      channel,
      from: monthStart,
      to: DATASET_NOW,
    },
  ];

  const monthlyComparison = await Promise.all(
    comparisonPeriods.map(async (period) =>
      summaryFromConsumption(
        period.label,
        await fetchConsumption(
          period.channel,
          period.from,
          period.to,
        ),
      ),
    ),
  );

  const currentMonth =
    monthlyComparison[monthlyComparison.length - 1];
  const previousMonth =
    monthlyComparison[monthlyComparison.length - 2];

  const historicalProfile = await fetchHourlyProfile(
    channel,
    subHours(DATASET_NOW, 24),
    DATASET_NOW,
  );

  const historicalData = pivotHourlyProfile(
    historicalProfile.results,
  ).map((point) => ({
    timestamp: point.timestamp,
    freezerEnergy: point.freezerEnergy,
    equipmentEnergy: point.equipmentEnergy,
    totalEnergy: point.totalEnergy,
    occupancy: point.occupancy,
    temperature: loadToTemperature(
      NOMINAL_VOLTAGE,
      0.9,
    ),
    avgVoltage: NOMINAL_VOLTAGE,
    avgPowerFactor: 0.9,
  }));

  return {
    monthlyComparison,
    currentMonthData,
    historicalData,
    currentMonth,
    previousMonth,
    currentMonthLabel: format(
      DATASET_NOW,
      "MMMM yyyy",
    ),
    currentDataDays: currentMonthData.length,
    updatedAt: DATASET_NOW,
  };
}

export function getBusinessProjection(
  currentMonth: MonthlyComparisonPoint,
  measuredDays: number,
) {
  const totalDays = getDaysInMonth(DATASET_NOW);
  const projectionFactor =
    measuredDays > 0 ? totalDays / measuredDays : 1;

  const projectedRevenue =
    currentMonth.revenue * projectionFactor;
  const projectedEnergyCost =
    currentMonth.energyCost * projectionFactor;

  return {
    projectedRevenue,
    projectedEnergyCost,
    currentMargin:
      currentMonth.revenue > 0
        ? ((currentMonth.revenue -
            currentMonth.energyCost) /
            currentMonth.revenue) *
          100
        : 0,
    projectedMargin:
      projectedRevenue > 0
        ? ((projectedRevenue - projectedEnergyCost) /
            projectedRevenue) *
          100
        : 0,
  };
}

export function getBusinessVariation(
  currentMonth: MonthlyComparisonPoint,
  previousMonth: MonthlyComparisonPoint,
) {
  return {
    energyCostChange:
      previousMonth.energyCost > 0
        ? ((currentMonth.energyCost -
            previousMonth.energyCost) /
            previousMonth.energyCost) *
          100
        : 0,
    revenueChange:
      previousMonth.revenue > 0
        ? ((currentMonth.revenue -
            previousMonth.revenue) /
            previousMonth.revenue) *
          100
        : 0,
  };
}

export function toBusinessHourlyPattern(
  data: OperationalPoint[],
) {
  return data.map((point) => ({
    hour: hourLabel(point.timestamp.getHours()),
    avgEnergy: Number(point.totalEnergy.toFixed(1)),
    avgOccupancy: Number(point.occupancy.toFixed(1)),
  }));
}
