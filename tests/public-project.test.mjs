import assert from "node:assert/strict";
import test from "node:test";
import { getPublicProject, normalizeProjectUrl, parsePublicProject } from "../dist/public-project.js";

const URL = "https://www.99freelas.com.br/project/exemplo-de-projeto-12345";

test("normalizes a public project URL and drops query parameters", () => {
  assert.equal(normalizeProjectUrl("https://99freelas.com.br/project/exemplo-12345?fs=t").toString(),
    "https://www.99freelas.com.br/project/exemplo-12345");
});

for (const url of [
  "https://evil.example/project/test-123",
  "http://www.99freelas.com.br/project/test-123",
  "https://www.99freelas.com.br.evil.example/project/test-123",
  "https://user:secret@www.99freelas.com.br/project/test-123",
  "https://www.99freelas.com.br/profile/edit",
  "https://www.99freelas.com.br/project/new",
  "https://www.99freelas.com.br/project/NEW/",
  "https://www.99freelas.com.br:8443/project/test-123",
]) {
  test(`rejects unsafe or non-project URL: ${url}`, () => {
    assert.throws(() => normalizeProjectUrl(url));
  });
}

test("parses a public project without inventing availability", () => {
  const item = parsePublicProject(`<html><head><meta property="og:title" content="Integração de planilhas | Projeto | 99Freelas"/><meta name="description" content="Preciso conectar duas planilhas."/></head></html>`, URL);
  assert.deepEqual(item, {
    url: URL,
    title: "Integração de planilhas",
    summary: "Preciso conectar duas planilhas.",
    description: null,
    availability: "unknown",
    source: "public-html",
  });
});

test("reads only explicit status indicators", () => {
  const item = parsePublicProject(`<h1>Criação de site</h1><span class="project-status">Fechado</span>`, URL);
  assert.equal(item.availability, "closed");
});

test("reads the observed closed-project control without guessing from unrelated text", () => {
  const closed = parsePublicProject('<h1>Projeto</h1><div class="box-project-view-info"><button class="btn status-11">Fechado</button></div>', URL);
  assert.equal(closed.availability, "closed");
  const unrelated = parsePublicProject('<h1>Projeto</h1><div class="project-description">O sistema anterior foi fechado.</div>', URL);
  assert.equal(unrelated.availability, "unknown");
});

test("extracts the public project description without scripts and handles ambiguous sections", () => {
  const project = parsePublicProject('<h1>Projeto</h1><div class="project-description">Primeira linha<br>Segunda linha<script>secret()</script></div>', URL);
  assert.equal(project.description, "Primeira linha Segunda linha");
  const ambiguous = parsePublicProject('<h1>Projeto</h1><div class="project-description">Um</div><div class="project-description">Dois</div>', URL);
  assert.equal(ambiguous.description, null);
});

test("normalizes HTML breaks from a real-style meta description", () => {
  const item = parsePublicProject(`<html><head><meta property="og:title" content="Integração de atendimento | 99Freelas"/><meta name="description" content="Primeira linha&lt;br/&gt;&lt;br/&gt;Segunda linha"/></head></html>`, URL);
  assert.equal(item.summary, "Primeira linha Segunda linha");
  assert.doesNotMatch(item.summary, /<br/i);
});

test("blocks redirection, including possible off-domain targets", async () => {
  const fetchStub = async () => new Response("", { status: 302, headers: { location: "https://evil.example" } });
  await assert.rejects(getPublicProject(URL, fetchStub), /Redirect blocked/);
});

test("does not send cookies and reads a capped HTML response", async () => {
  let observed;
  const fetchStub = async (url, options) => {
    observed = { url: url.toString(), ...options };
    return new Response(`<h1>Integração simples</h1>`, { headers: { "content-type": "text/html" } });
  };
  const item = await getPublicProject(URL, fetchStub);
  assert.equal(item.title, "Integração simples");
  assert.equal(observed.url, URL);
  assert.equal(observed.method, "GET");
  assert.equal(observed.redirect, "manual");
  assert.equal(observed.credentials, "omit");
  assert.equal(observed.cache, "no-store");
  assert.equal(observed.headers.cookie, undefined);
});

test("rejects oversized HTML responses", async () => {
  const fetchStub = async () => new Response("a".repeat(1024 * 1024 + 1), { headers: { "content-type": "text/html" } });
  await assert.rejects(getPublicProject(URL, fetchStub), /allowed size/);
});

test("propagates network errors without manufacturing project data", async () => {
  const fetchStub = async () => { throw new Error("Network unavailable"); };
  await assert.rejects(getPublicProject(URL, fetchStub), /Network unavailable/);
});

test("fails closed when no project title can be verified", async () => {
  const fetchStub = async () => new Response("<html><body>No project</body></html>", { headers: { "content-type": "text/html" } });
  await assert.rejects(getPublicProject(URL, fetchStub), /title could not be verified/);
});
