import { Client } from "@modelcontextprotocol/client";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { fileURLToPath } from "node:url";

const url = process.argv[2];
if (!url || process.argv.length !== 3) {
  process.stderr.write("Usage: npm run smoke:public -- <public-99freelas-project-url>\n");
  process.exit(2);
}

const env = getDefaultEnvironment();
for (const name of ["LOCALAPPDATA", "FREELAS_SUBMITTED_PROJECTS_FILE"]) {
  if (process.env[name]) env[name] = process.env[name];
}
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
  env,
});
const client = new Client({ name: "basality-public-smoke", version: "1.0.0" });

async function call(name, args) {
  const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 20000 });
  if (result.isError) throw new Error(result.content?.[0]?.text ?? `${name} failed`);
  return result.structuredContent ?? JSON.parse(result.content[0].text);
}

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const names = tools.map(tool => tool.name).sort();
  const expected = ["profile_get_public", "projects_get_public", "proposals_prepare_public_review", "system_health"];
  if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error("Unexpected tool catalog.");
  const health = await call("system_health", {});
  if (health.mode !== "public-read-only") throw new Error("Unexpected server mode.");
  const project = await call("projects_get_public", { url });
  const preview = await call("proposals_prepare_public_review", {
    url,
    approach: "Mapear o processo descrito e definir uma entrega inicial com acompanhamento e validação junto à equipe.",
    clarifyingQuestion: "Como a equipe realiza esse processo hoje e qual é a principal dificuldade?",
  });
  if (preview.canSend !== false || preview.humanApprovalRequired !== true) throw new Error("Unexpected preview safety flags.");
  process.stdout.write(JSON.stringify({
    status: "PASS", tools: names, project: { url: project.url, title: project.title, availability: project.availability },
    preview: { readiness: preview.readiness, duplicateGate: preview.duplicateGate, canSend: preview.canSend },
  }, null, 2) + "\n");
} catch (error) {
  process.stderr.write(`Smoke test failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
  process.exitCode = 1;
} finally {
  await client.close();
}
