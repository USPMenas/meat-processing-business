import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiRefreshNotice } from "../src/app/components/dashboard/ApiRefreshNotice";
import { useDashboardAutoRefresh } from "../src/app/hooks/useDashboardAutoRefresh";

function TestDashboard({
  loader,
}: {
  loader: (options?: { forceRefresh?: boolean }) => Promise<{
    label: string;
  }>;
}) {
  const {
    data,
    isInitialLoading,
    lastFetchedAt,
    showRefreshNotice,
  } = useDashboardAutoRefresh({
    errorMessage: "Falha ao carregar.",
    loader,
    noticeDurationMs: 80,
    refreshIntervalMs: 300,
    scope: "test",
  });

  return (
    <div>
      <span>
        {isInitialLoading
          ? "loading"
          : data?.label ?? "empty"}
      </span>
      <ApiRefreshNotice
        lastFetchedAt={lastFetchedAt}
        visible={showRefreshNotice}
      />
    </div>
  );
}

describe("dashboard auto refresh", () => {
  it(
    "refreshes automatically and only shows the API card after successful loads",
    async () => {
      const loader = vi
        .fn()
        .mockResolvedValueOnce({ label: "primeira-carga" })
        .mockResolvedValueOnce({ label: "segunda-carga" })
        .mockResolvedValue({ label: "segunda-carga" });

      const { unmount } = render(
        <TestDashboard loader={loader} />,
      );

      expect(
        await screen.findByText("primeira-carga"),
      ).toBeInTheDocument();
      expect(
        await screen.findByText("Dados atualizados pela API"),
      ).toBeInTheDocument();
      expect(loader).toHaveBeenNthCalledWith(1, {
        forceRefresh: false,
        refreshReason: "initial",
      });

      await waitFor(
        () => {
          expect(
            screen.queryByText("Dados atualizados pela API"),
          ).not.toBeInTheDocument();
        },
        { timeout: 1000 },
      );

      await waitFor(
        () => {
          expect(loader.mock.calls.length).toBeGreaterThanOrEqual(
            2,
          );
        },
        { timeout: 1000 },
      );

      expect(
        await screen.findByText("segunda-carga"),
      ).toBeInTheDocument();
      expect(loader).toHaveBeenNthCalledWith(2, {
        forceRefresh: true,
        refreshReason: "poll",
      });
      expect(
        await screen.findByText("Dados atualizados pela API"),
      ).toBeInTheDocument();

      unmount();
    },
    10000,
  );
});
