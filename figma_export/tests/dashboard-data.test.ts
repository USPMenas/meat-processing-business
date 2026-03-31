import { describe, expect, it } from "vitest";
import { __test__ } from "../src/app/services/dashboardData";

describe("dashboard data mappings", () => {
  it("groups measurements by minute and derives totals", () => {
    const points = __test__.measurementsByMinute([
      {
        channel: "lab",
        sensor: "fase1",
        apparent_power: 0,
        active_power: 10,
        reactive_power: 0,
        power_factor: 0.9,
        current: 0.1,
        voltage: 128,
        timestamp: "2026-03-31T10:00:10",
      },
      {
        channel: "lab",
        sensor: "fase2",
        apparent_power: 0,
        active_power: 5,
        reactive_power: 0,
        power_factor: 0.7,
        current: 0.1,
        voltage: 129,
        timestamp: "2026-03-31T10:00:25",
      },
      {
        channel: "lab",
        sensor: "fase3",
        apparent_power: 0,
        active_power: 8,
        reactive_power: 0,
        power_factor: 0.8,
        current: 0.1,
        voltage: 127,
        timestamp: "2026-03-31T10:00:40",
      },
      {
        channel: "lab",
        sensor: "fase1",
        apparent_power: 0,
        active_power: 11,
        reactive_power: 0,
        power_factor: 0.91,
        current: 0.1,
        voltage: 128.4,
        timestamp: "2026-03-31T10:01:10",
      },
      {
        channel: "lab",
        sensor: "fase2",
        apparent_power: 0,
        active_power: 5.5,
        reactive_power: 0,
        power_factor: 0.72,
        current: 0.1,
        voltage: 129.2,
        timestamp: "2026-03-31T10:01:25",
      },
      {
        channel: "lab",
        sensor: "fase3",
        apparent_power: 0,
        active_power: 7.4,
        reactive_power: 0,
        power_factor: 0.82,
        current: 0.1,
        voltage: 127.4,
        timestamp: "2026-03-31T10:01:40",
      },
    ]);

    expect(points).toHaveLength(2);
    expect(points[0].freezerEnergy).toBeCloseTo(10, 3);
    expect(points[0].equipmentEnergy).toBeCloseTo(13, 3);
    expect(points[0].totalEnergy).toBeCloseTo(23, 3);
    expect(points[0].temperature).toBeGreaterThan(-21);
    expect(points[0].temperature).toBeLessThan(-16);
    expect(points[0].occupancy).toBeGreaterThanOrEqual(45);
    expect(points[0].occupancy).toBeLessThanOrEqual(92);
  });

  it("builds alerts only for high voltage anomaly counts and demand peaks", () => {
    const alerts = __test__.buildAlerts(
      {
        channel: "lab",
        from: "2026-03-30T00:00:00",
        to: "2026-03-31T00:00:00",
        results: [
          {
            sensor: "fase2",
            avg_power_factor: 0.24,
            avg_voltage: 129,
          },
        ],
      },
      {
        channel: "lab",
        from: "2026-03-30T00:00:00",
        to: "2026-03-31T00:00:00",
        results: [
          {
            sensor: "fase1",
            peak_kw: 29.4,
            timestamp: "2026-03-31T08:00:00",
          },
        ],
      },
      {
        channel: "lab",
        from: "2026-03-30T00:00:00",
        to: "2026-03-31T00:00:00",
        lower_limit: 117,
        upper_limit: 133,
        nominal_voltage: 127,
        results: Array.from({ length: 101 }, (_, index) => ({
          timestamp: `2026-03-31T08:${String(index % 60).padStart(2, "0")}:00`,
          sensor: "fase2",
          voltage: 134,
          anomaly_type: "over_voltage",
          deviation_pct: 5.2,
        })),
      },
    );

    expect(alerts).toHaveLength(2);
    expect(
      alerts.some((alert) => alert.variable === "Tensao"),
    ).toBe(true);
    expect(
      alerts.some((alert) =>
        alert.variable.startsWith("Pico de Demanda"),
      ),
    ).toBe(true);
    expect(
      alerts.some((alert) =>
        alert.variable.includes("Fator de Potencia"),
      ),
    ).toBe(false);
  });

  it("pivots hourly profile into ordered hourly points", () => {
    const points = __test__.pivotHourlyProfile([
      {
        hour: "8",
        sensor: "fase2",
        avg_power_kw: 7,
      },
      {
        hour: "8",
        sensor: "fase1",
        avg_power_kw: 11,
      },
      {
        hour: "8",
        sensor: "fase3",
        avg_power_kw: 6,
      },
      {
        hour: "9",
        sensor: "fase1",
        avg_power_kw: 12,
      },
      {
        hour: "9",
        sensor: "fase2",
        avg_power_kw: 8,
      },
      {
        hour: "9",
        sensor: "fase3",
        avg_power_kw: 6.5,
      },
    ]);

    expect(points).toHaveLength(2);
    expect(points[0].hour).toBe(8);
    expect(points[0].totalEnergy).toBeCloseTo(24, 3);
    expect(points[1].hour).toBe(9);
    expect(points[1].occupancy).toBeGreaterThanOrEqual(45);
    expect(points[1].occupancy).toBeLessThanOrEqual(92);
  });

  it("accepts dashboard options objects without corrupting the channel", () => {
    expect(
      __test__.resolveDashboardQuery({
        forceRefresh: false,
        refreshReason: "initial",
      }),
    ).toEqual({
      channel: "lab",
      options: {
        forceRefresh: false,
        refreshReason: "initial",
      },
    });

    expect(
      __test__.resolveDashboardQuery("mock01", {
        forceRefresh: true,
        refreshReason: "poll",
      }),
    ).toEqual({
      channel: "mock01",
      options: {
        forceRefresh: true,
        refreshReason: "poll",
      },
    });
  });
});
