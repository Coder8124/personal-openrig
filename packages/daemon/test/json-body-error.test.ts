import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type Database from "better-sqlite3";
import { createFullTestDb, createTestApp } from "./helpers/test-app.js";
import { jsonBodyErrorHandler } from "../src/middleware/json-body-error.js";

const post = (body: string) => ({ method: "POST", headers: { "content-type": "application/json" }, body });

describe("malformed request bodies", () => {
  let db: Database.Database;
  beforeEach(() => { db = createFullTestDb(); });
  afterEach(() => { db.close(); });

  for (const path of ["/api/ask", "/api/transport/send", "/api/transport/capture", "/api/transport/broadcast"]) {
    it(`${path} answers 400, not 500, for a body that is not JSON`, async () => {
      const { app } = createTestApp(db);
      for (const body of ["{", "not json", ""]) {
        const res = await app.request(path, post(body));
        expect(res.status, JSON.stringify(body)).toBe(400);
        expect(await res.json()).toEqual({ error: "invalid_json", message: "Request body is not valid JSON." });
      }
    });
  }
});

describe("jsonBodyErrorHandler", () => {
  function appThrowing(err: unknown): Hono {
    const app = new Hono();
    app.onError(jsonBodyErrorHandler);
    app.post("/x", async (c) => { await c.req.text(); throw err; });
    return app;
  }

  it("keeps a SyntaxError from anything but the request body a 500", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await appThrowing(new SyntaxError("stored state")).request("/x", post('{"ok":true}'));
      expect(res.status).toBe(500);
    } finally {
      spy.mockRestore();
    }
  });

  it("passes HTTPException responses through", async () => {
    const res = await appThrowing(new HTTPException(418, { message: "teapot" })).request("/x", post("{"));
    expect(res.status).toBe(418);
  });
});
