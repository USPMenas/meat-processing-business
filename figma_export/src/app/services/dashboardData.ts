import {
  addMinutes,
  eachDayOfInterval,
  format,
  getDaysInMonth,
  startOfDay,
  startOfMonth,
  subHours,
  subMinutes,
} from "date-fns";
import { ptBR } from "date-fns/locale";

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
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);
const API_CACHE_TTL_MS = Number(
  import.meta.env.VITE_TCC_CACHE_TTL_MS ?? 300000,
);
const API_PERSISTENT_CACHE_TTL_MS = Number(
  import.meta.env.VITE_TCC_PERSISTENT_CACHE_TTL_MS ??
    21600000,
);
const API_REQUEST_TIMEOUT_MS = Number(
  import.meta.env.VITE_TCC_REQUEST_TIMEOUT_MS ?? 10000,
);
const BUSINESS_REQUEST_TIMEOUT_MS = Number(
  import.meta.env.VITE_TCC_BUSINESS_REQUEST_TIMEOUT_MS ??
    25000,
);
const BUSINESS_COMPARISON_CONCURRENCY = Number(
  import.meta.env
    .VITE_TCC_BUSINESS_COMPARISON_CONCURRENCY ?? 2,
);

const responseCache = new Map<
  string,
  { expiresAt: number; data: unknown }
>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const PERSISTENT_CACHE_PREFIX = "tcc-api-cache:";
let localStorageAvailable: boolean | null = null;

export interface DashboardLoadOptions {
  forceRefresh?: boolean;
  refreshReason?: "initial" | "poll";
  timeoutMs?: number;
}

interface ApiGetOptions extends DashboardLoadOptions {
  cacheTtlMs?: number;
  persistentCacheTtlMs?: number;
  timeoutMs?: number;
}

export interface DashboardQueryOptions
  extends DashboardLoadOptions {
  channel?: string;
}

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

function shouldLogRequests() {
  return (
    import.meta.env.DEV ||
    import.meta.env.VITE_TCC_DEBUG === "1"
  );
}

function logRequest(
  label: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  if (!shouldLogRequests()) return;
  console.info(`[tcc:${label}] ${message}`, extra ?? "");
}

function supportsLocalStorage() {
  if (localStorageAvailable !== null) {
    return localStorageAvailable;
  }

  if (
    typeof window === "undefined" ||
    typeof window.localStorage === "undefined"
  ) {
    localStorageAvailable = false;
    return localStorageAvailable;
  }

  try {
    const probeKey = `${PERSISTENT_CACHE_PREFIX}probe`;
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    localStorageAvailable = true;
  } catch {
    localStorageAvailable = false;
  }

  return localStorageAvailable;
}

function persistentCacheKey(cacheKey: string) {
  return `${PERSISTENT_CACHE_PREFIX}${cacheKey}`;
}

function readPersistentCache<T>(
  cacheKey: string,
  allowExpired = false,
) {
  if (!supportsLocalStorage()) return null;

  try {
    const rawValue = window.localStorage.getItem(
      persistentCacheKey(cacheKey),
    );

    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as {
      expiresAt: number;
      data: T;
    };

    if (
      !allowExpired &&
      typeof parsed.expiresAt === "number" &&
      parsed.expiresAt <= Date.now()
    ) {
      window.localStorage.removeItem(
        persistentCacheKey(cacheKey),
      );
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writePersistentCache(
  cacheKey: string,
  data: unknown,
  ttlMs: number,
) {
  if (!supportsLocalStorage()) return;

  try {
    window.localStorage.setItem(
      persistentCacheKey(cacheKey),
      JSON.stringify({
        expiresAt: Date.now() + ttlMs,
        data,
      }),
    );
  } catch {
    logRequest("cache", "persistent-write-failed", {
      url: cacheKey,
    });
  }
}

function resolveDashboardQuery(
  channelOrOptions?: string | DashboardQueryOptions,
  options?: DashboardLoadOptions,
) {
  if (
    channelOrOptions &&
    typeof channelOrOptions === "object"
  ) {
    return {
      channel:
        channelOrOptions.channel ?? DEFAULT_CHANNEL,
      options: {
        forceRefresh: channelOrOptions.forceRefresh,
        refreshReason: channelOrOptions.refreshReason,
        timeoutMs: channelOrOptions.timeoutMs,
      },
    };
  }

  return {
    channel: channelOrOptions ?? DEFAULT_CHANNEL,
    options: options ?? {},
  };
}

function createTimeoutController(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    controller,
    clear: () => window.clearTimeout(timeoutId),
  };
}

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
  const value = format(date, "MMM/yy", {
    locale: ptBR,
  });
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

  if (basePoints.length === 0) {
    return [];
  }

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

  if (totals.length === 0) {
    return [];
  }

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
  if (hourlyData.length === 0) {
    return [];
  }

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
  if (values.length === 0) return [];
  const offset = referenceHour % values.length;
  return values
    .slice(offset)
    .concat(values.slice(0, offset));
}

function buildOccupancyForecast(
  hourlyData: ReturnType<typeof pivotHourlyProfile>,
  loadIndex: EnergyPricePoint[],
) {
  if (hourlyData.length === 0 || loadIndex.length === 0) {
    return [];
  }

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

  if (anomalyCount > 100) {
    alerts.push({
      type: "warning",
      variable: "Tensao",
      message:
        "Muitas ocorrencias fora da faixa nas ultimas 24h",
      value: anomalyCount,
      expected: 100,
    });
  }

  const peak = peaks.results.reduce<DemandPeakResult | null>(
    (highest, result) => {
      if (!highest) return result;
      return result.peak_kw > highest.peak_kw
        ? result
        : highest;
    },
    null,
  );

  if (peak && peak.peak_kw > 28) {
    alerts.push({
      type: "warning",
      variable: `Pico de Demanda - ${peak.sensor}`,
      message: "Carga elevada no periodo recente",
      value: peak.peak_kw,
      expected: 28,
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

function safeSinWave(
  index: number,
  totalPoints: number,
  amplitude: number,
  phase = 0,
) {
  if (totalPoints <= 1) return 0;

  return (
    Math.sin(
      (index / (totalPoints - 1)) * Math.PI * 2 + phase,
    ) * amplitude
  );
}

function buildBusinessDailySeries(
  days: Date[],
  energyCost: number,
  hourlyProfile: ReturnType<typeof pivotHourlyProfile>,
) {
  if (days.length === 0) return [];

  const averageHourlyEnergy =
    hourlyProfile.length > 0
      ? average(
          hourlyProfile.map((point) => point.totalEnergy),
        )
      : 0;
  const minHourlyEnergy =
    hourlyProfile.length > 0
      ? Math.min(
          ...hourlyProfile.map((point) => point.totalEnergy),
        )
      : averageHourlyEnergy;
  const maxHourlyEnergy =
    hourlyProfile.length > 0
      ? Math.max(
          ...hourlyProfile.map((point) => point.totalEnergy),
        )
      : averageHourlyEnergy;

  const weights = days.map((day, index) => {
    const weekday = day.getDay();
    const weekendFactor =
      weekday === 0 ? 0.91 : weekday === 6 ? 0.95 : 1.03;
    const cycleFactor =
      1 +
      safeSinWave(index, days.length, 0.06, 0.4) +
      safeSinWave(index, days.length, 0.03, 1.1);
    const loadFactor = normalize(
      averageHourlyEnergy,
      minHourlyEnergy,
      maxHourlyEnergy,
      0.98,
      1.04,
    );

    return Math.max(
      0.72,
      Number(
        (weekendFactor * cycleFactor * loadFactor).toFixed(4),
      ),
    );
  });

  const totalWeight = weights.reduce(
    (sum, value) => sum + value,
    0,
  );
  const normalizedWeights =
    totalWeight > 0
      ? weights.map((weight) => weight / totalWeight)
      : weights.map(() => 1 / days.length);

  return days.map((day, index) => {
    const dailyEnergy = Number(
      (energyCost * normalizedWeights[index]).toFixed(0),
    );

    return {
      day: day.getDate(),
      energy: dailyEnergy,
      revenue: Number(
        energyToRevenue(dailyEnergy).toFixed(0),
      ),
    };
  });
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
  options?: ApiGetOptions,
) {
  if (typeof pathName !== "string") {
    throw new Error(
      "Caminho de API invalido recebido pelo frontend.",
    );
  }

  const url = new URL(
    `${API_BASE}/${pathName.replace(/^\/+/, "")}`,
    window.location.origin,
  );

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value === undefined) return;
    url.searchParams.set(key, String(value));
  });

  const cacheKey = url.toString();
  const useCache = !options?.forceRefresh;
  const cached = useCache
    ? responseCache.get(cacheKey)
    : undefined;

  if (cached && cached.expiresAt > Date.now()) {
    logRequest("cache", "hit", { url: cacheKey });
    return cached.data as T;
  }

  if (!options?.forceRefresh) {
    const persisted = readPersistentCache<T>(cacheKey);

    if (persisted) {
      responseCache.set(cacheKey, {
        expiresAt: persisted.expiresAt,
        data: persisted.data,
      });

      logRequest("cache", "persistent-hit", {
        url: cacheKey,
      });
      return persisted.data;
    }
  }

  const inFlight = inFlightRequests.get(cacheKey);

  if (inFlight) {
    logRequest("cache", "join-inflight", { url: cacheKey });
    return (await inFlight) as T;
  }

  let lastError: Error | null = null;
  const requestPromise = (async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const startedAt = performance.now();
      const timeout = createTimeoutController(
        options?.timeoutMs ?? API_REQUEST_TIMEOUT_MS,
      );

      try {
        const response = await fetch(url.toString(), {
          signal: timeout.controller.signal,
        });
        const durationMs = Math.round(
          performance.now() - startedAt,
        );

        logRequest("http", "response", {
          url: cacheKey,
          attempt: attempt + 1,
          status: response.status,
          durationMs,
        });

        if (
          !response.ok &&
          RETRYABLE_STATUS_CODES.has(response.status) &&
          attempt < 2
        ) {
          await new Promise((resolve) =>
            setTimeout(resolve, 350 * (attempt + 1)),
          );
          continue;
        }

        if (!response.ok) {
          throw new Error(
            `Falha ao consultar a API (${response.status})`,
          );
        }

        const data = (await response.json()) as T;
        responseCache.set(cacheKey, {
          expiresAt:
            Date.now() +
            (options?.cacheTtlMs ?? API_CACHE_TTL_MS),
          data,
        });
        writePersistentCache(
          cacheKey,
          data,
          options?.persistentCacheTtlMs ??
            API_PERSISTENT_CACHE_TTL_MS,
        );

        return data;
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error("Falha ao consultar a API.");

        logRequest("http", "error", {
          url: cacheKey,
          attempt: attempt + 1,
          message: lastError.message,
        });

        if (attempt < 2) {
          await new Promise((resolve) =>
            setTimeout(resolve, 350 * (attempt + 1)),
          );
          continue;
        }
      } finally {
        timeout.clear();
      }
    }

    const persistedFallback = readPersistentCache<T>(
      cacheKey,
      true,
    );

    if (persistedFallback) {
      logRequest("cache", "persistent-fallback", {
        url: cacheKey,
      });
      return persistedFallback.data;
    }

    throw lastError ?? new Error("Falha ao consultar a API.");
  })();

  inFlightRequests.set(cacheKey, requestPromise);

  try {
    return (await requestPromise) as T;
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(
        items[currentIndex],
        currentIndex,
      );
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => runWorker(),
  );
  await Promise.all(workers);
  return results;
}

async function fetchMeasurements(
  channel: string,
  from: Date,
  to: Date,
  options?: DashboardLoadOptions,
) {
  return apiGet<MeasurementsResponse>(channel, {
    from_time: formatApiDate(from),
    to_time: formatApiDate(to),
  }, options);
}

async function fetchConsumption(
  channel: string,
  from: Date,
  to: Date,
  options?: DashboardLoadOptions,
) {
  return apiGet<ConsumptionResponse>(
    `analytics/${channel}/consumption`,
    {
      from_time: formatApiDate(from),
      to_time: formatApiDate(to),
    },
    options,
  );
}

async function fetchElectricalHealth(
  channel: string,
  from: Date,
  to: Date,
  options?: DashboardLoadOptions,
) {
  return apiGet<ElectricalHealthResponse>(
    `analytics/${channel}/electrical_health`,
    {
      from_time: formatApiDate(from),
      to_time: formatApiDate(to),
    },
    options,
  );
}

async function fetchDemandPeaks(
  channel: string,
  from: Date,
  to: Date,
  options?: DashboardLoadOptions,
) {
  return apiGet<DemandPeaksResponse>(
    `analytics/${channel}/demand_peaks`,
    {
      from_time: formatApiDate(from),
      to_time: formatApiDate(to),
    },
    options,
  );
}

async function fetchHourlyProfile(
  channel: string,
  from: Date,
  to: Date,
  options?: DashboardLoadOptions,
) {
  return apiGet<HourlyProfileResponse>(
    `analytics/${channel}/hourly_profile`,
    {
      from_time: formatApiDate(from),
      to_time: formatApiDate(to),
    },
    options,
  );
}

async function fetchVoltageAnomalies(
  channel: string,
  from: Date,
  to: Date,
  options?: DashboardLoadOptions,
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
    options,
  );
}

export async function getOperationalDashboardData(
  channelOrOptions?: string | DashboardQueryOptions,
  options?: DashboardLoadOptions,
): Promise<OperationalDashboardData> {
  const resolved = resolveDashboardQuery(
    channelOrOptions,
    options,
  );
  const historyStart = subMinutes(DATASET_NOW, 60);
  const alertStart = subHours(DATASET_NOW, 24);

  const [measurements, health, peaks, anomalies] =
    await Promise.all([
      fetchMeasurements(
        resolved.channel,
        historyStart,
        DATASET_NOW,
        resolved.options,
      ),
      fetchElectricalHealth(
        resolved.channel,
        historyStart,
        DATASET_NOW,
        resolved.options,
      ),
      fetchDemandPeaks(
        resolved.channel,
        alertStart,
        DATASET_NOW,
        resolved.options,
      ),
      fetchVoltageAnomalies(
        resolved.channel,
        alertStart,
        DATASET_NOW,
        resolved.options,
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
  channelOrOptions?: string | DashboardQueryOptions,
  options?: DashboardLoadOptions,
): Promise<LogisticsDashboardData> {
  const resolved = resolveDashboardQuery(
    channelOrOptions,
    options,
  );
  const from = subHours(DATASET_NOW, 24);
  const profile = await fetchHourlyProfile(
    resolved.channel,
    from,
    DATASET_NOW,
    resolved.options,
  );

  const hourlyProfile = pivotHourlyProfile(profile.results);

  if (hourlyProfile.length === 0) {
    throw new Error("Sem dados logisticos disponiveis.");
  }

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
  channelOrOptions?: string | DashboardQueryOptions,
  options?: DashboardLoadOptions,
): Promise<BusinessDashboardData> {
  const resolved = resolveDashboardQuery(
    channelOrOptions,
    options,
  );
  const monthStart = startOfMonth(DATASET_NOW);
  const monthDays = eachDayOfInterval({
    start: monthStart,
    end: startOfDay(DATASET_NOW),
  });
  const businessRequestOptions = {
    ...resolved.options,
    timeoutMs:
      resolved.options.timeoutMs ??
      BUSINESS_REQUEST_TIMEOUT_MS,
  };

  const comparisonPeriods = [
    {
      label: "Nov/25",
      channel: "mock01",
      from: new Date("2025-11-01T00:00:00"),
      to: new Date("2025-11-30T23:59:59"),
    },
    {
      label: "Dez/25",
      channel: "mock01",
      from: new Date("2025-12-01T00:00:00"),
      to: new Date("2025-12-31T23:59:59"),
    },
  ];

  const monthlyComparisonPromise = mapWithConcurrency(
    comparisonPeriods,
    BUSINESS_COMPARISON_CONCURRENCY,
    async (period) =>
      summaryFromConsumption(
        period.label,
        await fetchConsumption(
          period.channel,
          period.from,
          period.to,
          businessRequestOptions,
        ),
      ),
  );
  const currentMonthConsumptionPromise = fetchConsumption(
    resolved.channel,
    monthStart,
    DATASET_NOW,
    businessRequestOptions,
  );
  const historicalProfilePromise = fetchHourlyProfile(
    resolved.channel,
    subHours(DATASET_NOW, 24),
    DATASET_NOW,
    resolved.options,
  );

  const [
    monthlyComparisonBase,
    currentMonthConsumption,
    historicalProfile,
  ] = await Promise.all([
    monthlyComparisonPromise,
    currentMonthConsumptionPromise,
    historicalProfilePromise,
  ]);

  const currentMonth = summaryFromConsumption(
    formatMonthLabel(DATASET_NOW),
    currentMonthConsumption,
  );
  const monthlyComparison = [
    ...monthlyComparisonBase,
    currentMonth,
  ];
  const previousMonth =
    monthlyComparison[monthlyComparison.length - 2];
  const hourlyProfile = pivotHourlyProfile(
    historicalProfile.results,
  );
  const currentMonthData = buildBusinessDailySeries(
    monthDays,
    currentMonth.energyCost,
    hourlyProfile,
  );

  const historicalData = hourlyProfile.map((point) => ({
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
      { locale: ptBR },
    ),
    currentDataDays: monthDays.length,
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

export const __test__ = {
  buildAlerts,
  loadToOccupancy,
  loadToTemperature,
  measurementsByMinute,
  pivotHourlyProfile,
  resolveDashboardQuery,
};
