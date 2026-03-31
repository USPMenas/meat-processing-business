import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import BusinessDashboard from "../src/app/pages/BusinessDashboard";
import LogisticsDashboard from "../src/app/pages/LogisticsDashboard";
import OperationalDashboard from "../src/app/pages/OperationalDashboard";

vi.mock("../src/app/services/dashboardData", () => ({
  getOperationalDashboardData: vi.fn().mockResolvedValue({
    currentData: {
      timestamp: new Date("2026-03-31T10:43:04"),
      freezerEnergy: 22.7,
      equipmentEnergy: 6.9,
      totalEnergy: 29.6,
      temperature: -18.2,
      occupancy: 71.4,
      avgVoltage: 127.7,
      avgPowerFactor: 0.86,
    },
    historicalData: Array.from({ length: 12 }, (_, index) => ({
      timestamp: new Date(
        `2026-03-31T10:${String(index).padStart(2, "0")}:00`,
      ),
      freezerEnergy: 20 + index * 0.1,
      equipmentEnergy: 7 + index * 0.05,
      totalEnergy: 27 + index * 0.15,
      temperature: -18.3 + index * 0.01,
      occupancy: 68 + index * 0.2,
      avgVoltage: 127.2,
      avgPowerFactor: 0.84,
    })),
    predictionData: Array.from({ length: 3 }, (_, index) => ({
      timestamp: new Date(
        `2026-03-31T11:0${index}:00`,
      ),
      freezerEnergy: 21.5,
      equipmentEnergy: 7.2,
      totalEnergy: 28.7,
      temperature: -18.1,
      occupancy: 72,
      avgVoltage: 127.1,
      avgPowerFactor: 0.85,
    })),
    alerts: [],
    updatedAt: new Date("2026-03-31T10:43:04"),
  }),
  getLogisticsDashboardData: vi.fn().mockResolvedValue({
    historicalData: Array.from({ length: 24 }, (_, hour) => ({
      timestamp: new Date(
        `2026-03-31T${String(hour).padStart(2, "0")}:00:00`,
      ),
      freezerEnergy: 12 + hour * 0.1,
      equipmentEnergy: 8 + hour * 0.05,
      totalEnergy: 20 + hour * 0.15,
      temperature: -18,
      occupancy: 60 + hour * 0.5,
      avgVoltage: 127,
      avgPowerFactor: 0.84,
    })),
    energyPrices: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      price: 0.5 + (hour % 4) * 0.05,
    })),
    occupancyForecast: Array.from(
      { length: 24 },
      (_, hour) => ({
        hour,
        occupancy: 55 + hour * 0.6,
        energyPrice: 0.5 + (hour % 4) * 0.05,
      }),
    ),
    hourlyData: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      energy: 20 + hour * 0.2,
      occupancy: 60 + hour * 0.4,
      price: 0.5 + (hour % 4) * 0.05,
    })),
    avgEnergy: 24.6,
    peakOccupancy: 82.4,
    lowEnergyHours: 8,
    nextIdealHour: 23,
    updatedAt: new Date("2026-03-31T10:43:04"),
  }),
  getBusinessDashboardData: vi.fn().mockResolvedValue({
    monthlyComparison: [
      { month: "Out/25", energyCost: 14000, revenue: 114800 },
      { month: "Dez/25", energyCost: 17000, revenue: 139400 },
      { month: "Mar/26", energyCost: 23000, revenue: 188600 },
    ],
    currentMonthData: Array.from({ length: 10 }, (_, index) => ({
      day: index + 1,
      energy: 900 + index * 10,
      revenue: 7380 + index * 82,
    })),
    historicalData: Array.from({ length: 24 }, (_, hour) => ({
      timestamp: new Date(
        `2026-03-31T${String(hour).padStart(2, "0")}:00:00`,
      ),
      freezerEnergy: 12 + hour * 0.1,
      equipmentEnergy: 8 + hour * 0.05,
      totalEnergy: 20 + hour * 0.15,
      temperature: -18,
      occupancy: 60 + hour * 0.4,
      avgVoltage: 127,
      avgPowerFactor: 0.84,
    })),
    currentMonth: {
      month: "Mar/26",
      energyCost: 23000,
      revenue: 188600,
    },
    previousMonth: {
      month: "Dez/25",
      energyCost: 17000,
      revenue: 139400,
    },
    currentMonthLabel: "marco 2026",
    currentDataDays: 10,
    updatedAt: new Date("2026-03-31T10:43:04"),
  }),
  getBusinessProjection: vi.fn().mockReturnValue({
    projectedRevenue: 584660,
    projectedEnergyCost: 71300,
    currentMargin: 87.8,
    projectedMargin: 87.8,
  }),
  getBusinessVariation: vi.fn().mockReturnValue({
    energyCostChange: 35.2,
    revenueChange: 35.3,
  }),
  toBusinessHourlyPattern: vi.fn().mockReturnValue(
    Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour}h`,
      avgEnergy: 20 + hour * 0.1,
      avgOccupancy: 60 + hour * 0.3,
    })),
  ),
}));

function renderWithRouter(ui: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={["/"]}>{ui}</MemoryRouter>,
  );
}

describe("platform pages", () => {
  it("renders operational dashboard with API-backed content", async () => {
    renderWithRouter(<OperationalDashboard />);
    expect(
      await screen.findByText("Monitoramento em Tempo Real"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Energia - Congelador"),
    ).toBeInTheDocument();
  });

  it("renders logistics dashboard with planning indicators", async () => {
    renderWithRouter(<LogisticsDashboard />);
    expect(
      await screen.findByText("Indicadores de Planejamento"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Consumo Medio (24h)"),
    ).toBeInTheDocument();
  });

  it("renders business dashboard with executive indicators", async () => {
    renderWithRouter(<BusinessDashboard />);
    expect(
      await screen.findByText(/Indicadores Financeiros -/),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Faturamento Atual"),
    ).toBeInTheDocument();
  });
});
