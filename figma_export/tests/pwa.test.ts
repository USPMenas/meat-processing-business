import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { registerPwa } from "../src/pwa/registerPwa";

describe("pwa setup", () => {
  it("exposes a standalone manifest with mobile icons", () => {
    const manifestPath = path.resolve(
      import.meta.dirname,
      "../public/manifest.webmanifest",
    );
    const manifest = JSON.parse(
      readFileSync(manifestPath, "utf8"),
    );

    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icons/icon-192.png",
          sizes: "192x192",
        }),
        expect.objectContaining({
          src: "/icons/icon-512.png",
          sizes: "512x512",
        }),
      ]),
    );
  });

  it("registers the service worker on window load", async () => {
    const register = vi.fn().mockResolvedValue({
      scope: "/",
    });

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    registerPwa();
    window.dispatchEvent(new Event("load"));
    await Promise.resolve();

    expect(register).toHaveBeenCalledWith("/sw.js");
  });
});
