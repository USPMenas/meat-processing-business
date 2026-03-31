import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { DashboardLoadOptions } from "../services/dashboardData";

interface UseDashboardAutoRefreshOptions<T> {
  errorMessage: string;
  loader: (
    options?: DashboardLoadOptions,
  ) => Promise<T>;
  noticeDurationMs?: number;
  refreshIntervalMs?: number;
  scope: string;
}

function shouldLogRefreshes() {
  return (
    import.meta.env.DEV ||
    import.meta.env.VITE_TCC_DEBUG === "1"
  );
}

function logRefresh(
  scope: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  if (!shouldLogRefreshes()) return;
  console.info(`[dashboard:${scope}] ${message}`, extra ?? "");
}

export function useDashboardAutoRefresh<T>({
  errorMessage,
  loader,
  noticeDurationMs = 3200,
  refreshIntervalMs = 20000,
  scope,
}: UseDashboardAutoRefreshOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] =
    useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] =
    useState<Date | null>(null);
  const [showRefreshNotice, setShowRefreshNotice] =
    useState(false);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const loadData = useCallback(
    async (reason: "initial" | "poll") => {
      if (inFlightRef.current) {
        logRefresh(scope, "skip-overlapping-refresh", {
          reason,
        });
        return;
      }

      inFlightRef.current = true;

      if (reason === "poll") {
        setIsRefreshing(true);
      } else {
        setIsInitialLoading(true);
      }

      logRefresh(scope, "load-start", { reason });

      try {
        const startedAt = performance.now();
        const nextData = await loader({
          forceRefresh: reason === "poll",
          refreshReason: reason,
        });

        if (!mountedRef.current) return;

        const fetchedAt = new Date();
        setData(nextData);
        setError(null);
        setLastFetchedAt(fetchedAt);
        setShowRefreshNotice(true);

        logRefresh(scope, "load-success", {
          reason,
          durationMs: Math.round(
            performance.now() - startedAt,
          ),
          fetchedAt: fetchedAt.toISOString(),
        });
      } catch (loadError) {
        if (!mountedRef.current) return;

        const nextError =
          loadError instanceof Error
            ? loadError.message
            : errorMessage;

        setError(nextError);

        logRefresh(scope, "load-error", {
          reason,
          message: nextError,
        });
      } finally {
        if (!mountedRef.current) return;
        setIsInitialLoading(false);
        setIsRefreshing(false);
        inFlightRef.current = false;
      }
    },
    [errorMessage, loader, scope],
  );

  useEffect(() => {
    mountedRef.current = true;
    void loadData("initial");

    const intervalId = window.setInterval(() => {
      void loadData("poll");
    }, refreshIntervalMs);

    return () => {
      mountedRef.current = false;
      window.clearInterval(intervalId);
    };
  }, [loadData, refreshIntervalMs]);

  useEffect(() => {
    if (!showRefreshNotice) return;

    const timeoutId = window.setTimeout(() => {
      setShowRefreshNotice(false);
    }, noticeDurationMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [noticeDurationMs, showRefreshNotice, lastFetchedAt]);

  return {
    data,
    error,
    isInitialLoading,
    isRefreshing,
    lastFetchedAt,
    showRefreshNotice,
  };
}
