import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

const PROXY_TIMEOUT_MS = 10000;

function tccApiProxyPlugin() {
  return {
    name: "tcc-api-proxy",
    configureServer(server) {
      server.middlewares.use("/api", async (req, res) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, PROXY_TIMEOUT_MS);

        try {
          const originalUrl =
            (req as { originalUrl?: string }).originalUrl ??
            req.url ??
            "";
          const proxiedPath = originalUrl.startsWith("/api")
            ? originalUrl.replace(/^\/api/, "/tcc")
            : `/tcc${
                originalUrl.startsWith("/")
                  ? originalUrl
                  : `/${originalUrl}`
              }`;
          const requestUrl = new URL(
            proxiedPath,
            "https://bor.gs",
          );
          const response = await fetch(requestUrl, {
            method: req.method,
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          });

          res.statusCode = response.status;
          const contentType =
            response.headers.get("content-type");

          if (contentType) {
            res.setHeader("content-type", contentType);
          }

          const payload = Buffer.from(
            await response.arrayBuffer(),
          );
          res.end(payload);
        } catch (error) {
          res.statusCode = 502;
          res.setHeader(
            "content-type",
            "application/json; charset=utf-8",
          );
          res.end(
            JSON.stringify({
              error: "proxy_error",
              message:
                error instanceof Error
                  ? error.message
                  : "Falha ao consultar a API remota.",
            }),
          );
        } finally {
          clearTimeout(timeoutId);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tccApiProxyPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  assetsInclude: ["**/*.svg", "**/*.csv"],
});
