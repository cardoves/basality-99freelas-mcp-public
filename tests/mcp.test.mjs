import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

test("MCP stdio handshake exposes only public and preview-only tools", { timeout: 15000 }, async () => {
  const transport = new StdioClientTransport({ command: process.execPath, args: ["dist/index.js"] });
  const client = new Client({ name: "basality-mcp-qa", version: "0.1.0" });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), ["profile_get_public", "projects_get_public", "proposals_prepare_public_review", "system_health"]);
    const health = await client.callTool({ name: "system_health", arguments: {} });
    assert.equal(health.isError, undefined);
    assert.match(health.content[0].text, /public-read-only/);
    const blocked = await client.callTool({ name: "projects_get_public", arguments: { url: "https://example.com/project/unsafe" } });
    assert.equal(blocked.isError, true);
    assert.match(blocked.content[0].text, /Only public HTTPS 99Freelas/);
    const preview = listed.tools.find(tool => tool.name === "proposals_prepare_public_review");
    assert.equal(preview?.annotations?.readOnlyHint, true);
    const blockedDraft = await client.callTool({
      name: "proposals_prepare_public_review",
      arguments: {
        url: "https://example.com/project/unsafe",
        approach: "Organizar o fluxo de recebimento, retorno e acompanhamento de cada solicitação.",
        clarifyingQuestion: "Como os pedidos são registrados e distribuídos hoje?",
      },
    });
    assert.equal(blockedDraft.isError, true);

    const blockedProfile = await client.callTool({ name: "profile_get_public", arguments: { url: "https://example.com/user/unsafe" } });
    assert.equal(blockedProfile.isError, true);
  } finally {
    await client.close();
  }
});
