function shouldLogPwa() {
  return (
    import.meta.env.DEV ||
    import.meta.env.VITE_TCC_DEBUG === "1"
  );
}

function logPwa(
  message: string,
  extra?: Record<string, unknown>,
) {
  if (!shouldLogPwa()) return;
  console.info(`[pwa] ${message}`, extra ?? "");
}

export function registerPwa() {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    return;
  }

  window.addEventListener(
    "load",
    async () => {
      try {
        const registration =
          await navigator.serviceWorker.register("/sw.js");

        logPwa("service-worker-registered", {
          scope: registration.scope,
        });
      } catch (error) {
        logPwa("service-worker-registration-failed", {
          message:
            error instanceof Error
              ? error.message
              : "Erro desconhecido",
        });
      }
    },
    { once: true },
  );
}
