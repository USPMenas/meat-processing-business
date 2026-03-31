import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Bell, Snowflake } from "lucide-react";
import { describe, expect, it } from "vitest";
import { AlertBanner } from "../src/app/components/dashboard/AlertBanner";
import { ApiRefreshNotice } from "../src/app/components/dashboard/ApiRefreshNotice";
import { MetricCardWithChart } from "../src/app/components/dashboard/MetricCardWithChart";
import { DashboardLayout } from "../src/app/components/layout/DashboardLayout";

describe("dashboard components", () => {
  it("renders alert banners only when alerts exist", () => {
    const { rerender } = render(
      <AlertBanner
        alerts={[
          {
            type: "warning",
            variable: "Tensao",
            message: "Fora da faixa",
            value: 12,
            expected: 0,
          },
        ]}
      />,
    );

    expect(screen.getByText("Tensao")).toBeInTheDocument();
    expect(
      screen.getByText("Fora da faixa: 12.0 (esperado: 0)"),
    ).toBeInTheDocument();

    rerender(<AlertBanner alerts={[]} />);
    expect(screen.queryByText("Tensao")).not.toBeInTheDocument();
  });

  it("shows the API refresh notice only when visible and dated", () => {
    const fetchedAt = new Date("2026-03-31T10:43:04");
    const { rerender } = render(
      <ApiRefreshNotice
        lastFetchedAt={fetchedAt}
        visible
      />,
    );

    expect(
      screen.getByText("Dados atualizados pela API"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Ultima resposta valida:/),
    ).toBeInTheDocument();

    rerender(
      <ApiRefreshNotice
        lastFetchedAt={fetchedAt}
        visible={false}
      />,
    );
    expect(
      screen.queryByText("Dados atualizados pela API"),
    ).not.toBeInTheDocument();
  });

  it("opens card details when the metric has drilldown content", () => {
    render(
      <MetricCardWithChart
        title="Energia"
        value={21.4}
        unit="kW"
        icon={Snowflake}
        subtitle="Carga principal"
        trend={{ value: 4.2, direction: "up" }}
        detailTitle="Energia - Detalhes"
        detailContent={<div>Grafico detalhado</div>}
        footer={<div>Base real da API</div>}
      />,
    );

    expect(screen.getByText("Energia")).toBeInTheDocument();
    expect(screen.getByText("↑ 4.2%")).toBeInTheDocument();
    expect(screen.getByText("Base real da API")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Energia"));

    expect(
      screen.getByText("Energia - Detalhes"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Grafico detalhado"),
    ).toBeInTheDocument();
  });

  it("marks the active navigation item in the dashboard layout", () => {
    render(
      <MemoryRouter initialEntries={["/business"]}>
        <DashboardLayout variant="business">
          <div>Conteudo executivo</div>
        </DashboardLayout>
      </MemoryRouter>,
    );

    const businessLink = screen.getByRole("link", {
      name: /Negocios/i,
    });
    const operationalLink = screen.getByRole("link", {
      name: /Operacional/i,
    });

    expect(businessLink.className).toContain("bg-blue-600");
    expect(operationalLink.className).not.toContain(
      "bg-blue-500",
    );
    expect(
      screen.getByText("Conteudo executivo"),
    ).toBeInTheDocument();
  });
});
