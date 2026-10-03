import type { Context, ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";

/**
 * App-level error handler. Routes that read their body with a bare
 * `await c.req.json()` throw a SyntaxError on a malformed body, which Hono's
 * default handler turns into a 500. That is a caller error, so answer 400.
 *
 * Only a SyntaxError whose request body really is unparseable JSON is mapped;
 * a SyntaxError from parsing anything else (stored state, a child's output)
 * stays a 500. Everything else gets Hono's default behavior.
 */
export const jsonBodyErrorHandler: ErrorHandler = async (err, c) => {
  if (err instanceof SyntaxError && await hasMalformedJsonBody(c)) {
    return c.json({ error: "invalid_json", message: "Request body is not valid JSON." }, 400);
  }
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.text("Internal Server Error", 500);
};

async function hasMalformedJsonBody(c: Context): Promise<boolean> {
  let text: string;
  try {
    text = await c.req.text();
  } catch {
    return false;
  }
  if (text.trim() === "") return true;
  try {
    JSON.parse(text);
    return false;
  } catch {
    return true;
  }
}
