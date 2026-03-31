import assert from "node:assert/strict";
import test from "node:test";

const API_BASE = "https://bor.gs";
const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);

async function apiGet(pathName, params = {}) {
  const normalizedPath = pathName.startsWith("/tcc")
    ? pathName
    : `/tcc${pathName.startsWith("/") ? pathName : `/${pathName}`}`;
  const url = new URL(normalizedPath, API_BASE);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    url.searchParams.set(key, String(value));
  });

  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url);

      if (
        !response.ok &&
        RETRYABLE_STATUS_CODES.has(response.status) &&
        attempt < 2
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, 400 * (attempt + 1)),
        );
        continue;
      }

      assert.equal(
        response.ok,
        true,
        `request failed with status ${response.status} for ${url}`,
      );

      return response.json();
    } catch (error) {
      lastError = error;

      if (attempt < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, 400 * (attempt + 1)),
        );
      }
    }
  }

  throw lastError;
}

test("openapi exposes expected analytics endpoints", async () => {
  const document = await apiGet("/openapi.json");

  assert.equal(document.info.title, "MQTT Measurements API");
  assert.ok(
    document.paths["/analytics/{channel}/consumption"],
  );
  assert.ok(
    document.paths["/analytics/{channel}/hourly_profile"],
  );
  assert.ok(document.paths["/{channel}"]);
});

test("consumption endpoint returns an array even on empty lab days", async () => {
  const data = await apiGet("/analytics/lab/consumption", {
    from_time: "2026-03-01T00:00:00",
    to_time: "2026-03-01T23:59:59",
  });

  assert.ok(Array.isArray(data.results));
  assert.equal(data.results.length, 0);
});

test("hourly profile returns data for the latest 24h window in lab", async () => {
  const data = await apiGet("/analytics/lab/hourly_profile", {
    from_time: "2026-03-30T10:43:04",
    to_time: "2026-03-31T10:43:04",
  });

  assert.ok(Array.isArray(data.results));
  assert.equal(data.results.length, 72);
  assert.ok(
    data.results.some((point) => point.sensor === "fase1"),
  );
  assert.ok(
    data.results.some((point) => point.hour === "10"),
  );
});

test("recent measurement window returns populated data", async () => {
  const data = await apiGet("/lab", {
    from_time: "2026-03-31T09:43:04",
    to_time: "2026-03-31T10:43:04",
  });

  assert.ok(Array.isArray(data.measurements));
  assert.ok(data.count > 0);
  assert.ok(
    data.measurements.every(
      (point) =>
        typeof point.active_power === "number" &&
        typeof point.voltage === "number",
    ),
  );
});
