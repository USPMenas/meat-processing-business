import { beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  };
}

function buildMeasurementResponse() {
  return {
    channel: "lab",
    from: "2026-03-31T09:43:04",
    to: "2026-03-31T10:43:04",
    count: 6,
    measurements: [
      {
        channel: "lab",
        sensor: "fase1",
        apparent_power: 0,
        active_power: 15,
        reactive_power: 0,
        power_factor: 0.9,
        current: 1,
        voltage: 128,
        timestamp: "2026-03-31T10:42:10",
      },
      {
        channel: "lab",
        sensor: "fase2",
        apparent_power: 0,
        active_power: 7,
        reactive_power: 0,
        power_factor: 0.82,
        current: 1,
        voltage: 127,
        timestamp: "2026-03-31T10:42:20",
      },
      {
        channel: "lab",
        sensor: "fase3",
        apparent_power: 0,
        active_power: 6,
        reactive_power: 0,
        power_factor: 0.8,
        current: 1,
        voltage: 126,
        timestamp: "2026-03-31T10:42:30",
      },
      {
        channel: "lab",
        sensor: "fase1",
        apparent_power: 0,
        active_power: 15.5,
        reactive_power: 0,
        power_factor: 0.91,
        current: 1,
        voltage: 128.1,
        timestamp: "2026-03-31T10:43:10",
      },
      {
        channel: "lab",
        sensor: "fase2",
        apparent_power: 0,
        active_power: 7.2,
        reactive_power: 0,
        power_factor: 0.83,
        current: 1,
        voltage: 127.1,
        timestamp: "2026-03-31T10:43:20",
      },
      {
        channel: "lab",
        sensor: "fase3",
        apparent_power: 0,
        active_power: 6.3,
        reactive_power: 0,
        power_factor: 0.81,
        current: 1,
        voltage: 126.3,
        timestamp: "2026-03-31T10:43:30",
      },
    ],
  };
}

function buildHourlyProfileResponse() {
  return {
    channel: "lab",
    from: "2026-03-30T10:43:04",
    to: "2026-03-31T10:43:04",
    results: Array.from({ length: 24 }, (_, hour) => [
      {
        hour: String(hour),
        sensor: "fase1",
        avg_power_kw: 14 + hour * 0.1,
      },
      {
        hour: String(hour),
        sensor: "fase2",
        avg_power_kw: 6 + hour * 0.05,
      },
      {
        hour: String(hour),
        sensor: "fase3",
        avg_power_kw: 5 + hour * 0.04,
      },
    ]).flat(),
  };
}

function clearStorage() {
  if (
    typeof window === "undefined" ||
    !window.localStorage ||
    typeof window.localStorage.removeItem !== "function"
  ) {
    return;
  }

  const keys = Object.keys(window.localStorage);
  keys.forEach((key) => {
    window.localStorage.removeItem(key);
  });
}

describe("dashboard service API calls", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    clearStorage();
  });

  it("builds correct operational URLs even when called with loader options", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));

      if (url.pathname.endsWith("/api/lab")) {
        return jsonResponse(buildMeasurementResponse());
      }

      if (
        url.pathname.endsWith(
          "/api/analytics/lab/electrical_health",
        )
      ) {
        return jsonResponse({
          channel: "lab",
          from: "",
          to: "",
          results: [
            {
              sensor: "fase1",
              avg_voltage: 127.3,
              avg_power_factor: 0.86,
            },
          ],
        });
      }

      if (
        url.pathname.endsWith("/api/analytics/lab/demand_peaks")
      ) {
        return jsonResponse({
          channel: "lab",
          from: "",
          to: "",
          results: [],
        });
      }

      if (
        url.pathname.endsWith(
          "/api/analytics/lab/voltage_anomalies",
        )
      ) {
        return jsonResponse({
          channel: "lab",
          from: "",
          to: "",
          lower_limit: 117,
          upper_limit: 133,
          nominal_voltage: 127,
          results: [],
        });
      }

      throw new Error(`Unhandled URL: ${url.toString()}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const services = await import(
      "../src/app/services/dashboardData"
    );

    const data =
      await services.getOperationalDashboardData({
        forceRefresh: false,
        refreshReason: "initial",
      });

    expect(data.historicalData.length).toBeGreaterThan(0);

    const requestedUrls = fetchMock.mock.calls.map(([input]) =>
      String(input),
    );

    expect(
      requestedUrls.some((url) => url.includes("/api/lab?")),
    ).toBe(true);
    expect(
      requestedUrls.some((url) =>
        url.includes(
          "/api/analytics/lab/electrical_health?",
        ),
      ),
    ).toBe(true);
    expect(
      requestedUrls.some((url) =>
        url.includes("/api/analytics/lab/demand_peaks?"),
      ),
    ).toBe(true);
    expect(
      requestedUrls.some((url) =>
        url.includes(
          "/api/analytics/lab/voltage_anomalies?",
        ),
      ),
    ).toBe(true);
    expect(
      requestedUrls.some((url) => url.includes("[object%20Object]")),
    ).toBe(false);
  });

  it("reuses cached hourly profile data instead of refetching historical series", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));

      if (
        url.pathname.endsWith("/api/analytics/lab/hourly_profile")
      ) {
        return jsonResponse(buildHourlyProfileResponse());
      }

      throw new Error(`Unhandled URL: ${url.toString()}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const services = await import(
      "../src/app/services/dashboardData"
    );

    const firstLoad =
      await services.getLogisticsDashboardData({
        forceRefresh: false,
        refreshReason: "initial",
      });

    expect(firstLoad.hourlyData).toHaveLength(24);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockClear();

    const secondLoad =
      await services.getLogisticsDashboardData({
        forceRefresh: false,
        refreshReason: "initial",
      });

    expect(secondLoad.hourlyData).toHaveLength(24);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the business dashboard request plan lightweight", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));

      if (
        url.pathname.endsWith("/api/analytics/lab/hourly_profile")
      ) {
        return jsonResponse(buildHourlyProfileResponse());
      }

      if (
        url.pathname.endsWith("/api/analytics/lab/consumption")
      ) {
        return jsonResponse({
          channel: "lab",
          from: url.searchParams.get("from_time"),
          to: url.searchParams.get("to_time"),
          results: [
            {
              sensor: "fase1",
              total_kwh: 4200,
              min_demand_kw: 12,
              max_demand_kw: 25,
            },
          ],
        });
      }

      if (
        url.pathname.endsWith("/api/analytics/mock01/consumption")
      ) {
        const fromTime =
          url.searchParams.get("from_time") ?? "";
        const monthlyBase =
          fromTime.startsWith("2025-10")
            ? 3200
            : fromTime.startsWith("2025-11")
              ? 3400
              : 3600;

        return jsonResponse({
          channel: "mock01",
          from: url.searchParams.get("from_time"),
          to: url.searchParams.get("to_time"),
          results: [
            {
              sensor: "fase1",
              total_kwh: monthlyBase,
              min_demand_kw: 10,
              max_demand_kw: 23,
            },
          ],
        });
      }

      throw new Error(`Unhandled URL: ${url.toString()}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const services = await import(
      "../src/app/services/dashboardData"
    );

    const data =
      await services.getBusinessDashboardData({
        forceRefresh: true,
        refreshReason: "initial",
      });

    const requestedUrls = fetchMock.mock.calls.map(([input]) =>
      String(input),
    );
    const consumptionUrls = requestedUrls.filter((url) =>
      url.includes("/consumption?"),
    );

    expect(consumptionUrls).toHaveLength(4);
    expect(
      consumptionUrls.every(
        (url) =>
          url.includes("from_time=2025-10-01") ||
          url.includes("from_time=2025-11-01") ||
          url.includes("from_time=2025-12-01") ||
          url.includes("from_time=2026-03-01"),
      ),
    ).toBe(true);
    expect(
      requestedUrls.filter((url) =>
        url.includes("/hourly_profile?"),
      ),
    ).toHaveLength(1);
    expect(data.currentMonthData).toHaveLength(31);
    expect(data.currentDataDays).toBe(31);
  });
});
