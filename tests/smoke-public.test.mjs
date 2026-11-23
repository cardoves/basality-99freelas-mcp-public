import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("public smoke requires a project URL before starting the MCP", () => {
  const result = spawnSync(process.execPath, ["scripts/smoke-public.mjs"], { encoding: "utf8", timeout: 10000 });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage: npm run smoke:public/);
  assert.equal(result.stdout, "");
});
