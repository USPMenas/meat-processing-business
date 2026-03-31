import { format } from "date-fns";
import { CheckCircle2, RefreshCw } from "lucide-react";

interface ApiRefreshNoticeProps {
  isRefreshing?: boolean;
  lastFetchedAt: Date | null;
  visible: boolean;
}

export function ApiRefreshNotice({
  isRefreshing = false,
  lastFetchedAt,
  visible,
}: ApiRefreshNoticeProps) {
  if (!visible || !lastFetchedAt) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 w-[260px] rounded-2xl border border-emerald-200 bg-white/95 p-4 shadow-lg backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-emerald-100 p-2">
          {isRefreshing ? (
            <RefreshCw className="size-4 animate-spin text-emerald-700" />
          ) : (
            <CheckCircle2 className="size-4 text-emerald-700" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            Dados atualizados pela API
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Ultima resposta valida:{" "}
            {format(lastFetchedAt, "HH:mm:ss")}
          </p>
        </div>
      </div>
    </div>
  );
}
