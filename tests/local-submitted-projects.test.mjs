import assert from "node:assert/strict";
import test from "node:test";
import {
  checkLocalSubmittedProjects,
  classifyLocalSubmittedProjects,
  isAllowedLocalSubmittedProjectsPath,
} from "../dist/local-submitted-projects.js";
import { buildPublicProposalReview } from "../dist/public-proposal-review.js";

const url = "https://www.99freelas.com.br/project/exemplo-123456";
const other = "https://www.99freelas.com.br/project/outro-654321";
const ledger = JSON.stringify({ schemaVersion: 1, submittedProjectUrls: [url] });
const project = {
  url,
  title: "Projeto de exemplo",
  summary: "Atendimento com muitos registros manuais.",
  availability: "unknown",
  source: "public-html",
};
const input = {
  url,
  approach: "Mapear as etapas e simplificar o registro das solicitações, preservando o acompanhamento humano.",
  clarifyingQuestion: "Quais dados são registrados manualmente hoje?",
};

test("explicitly listed project blocks a new draft without claiming a platform receipt", () => {
  assert.equal(classifyLocalSubmittedProjects(url, ledger), "listed_submitted");
  const r = buildPublicProposalReview(project, input, "listed_submitted");
  assert.equal(r.readiness, "known_duplicate");
  assert.equal(r.draft, null);
  assert.equal(r.canSend, false);
  assert.equal(r.humanApprovalRequired, true);
  assert.equal(r.duplicateStatus, "user_recorded_existing");
  assert.equal(r.duplicateGate, "BLOCKED");
  assert.equal(r.localRegistryStatus, "listed_submitted");
  assert.ok(r.warnings.some(w => /registro local/i.test(w)));
});

test("project absent from local list keeps duplicate status unverified", () => {
  assert.equal(classifyLocalSubmittedProjects(other, ledger), "not_listed_unverified");
  const r = buildPublicProposalReview(project, input, "not_listed_unverified");
  assert.equal(r.duplicateStatus, "not_verified");
  assert.equal(r.duplicateGate, "INCONCLUSIVE");
  assert.equal(r.canSend, false);
  assert.ok(r.warnings.some(w => /não comprova ausência/i.test(w)));
});

test("a different slug with the same project ID is still a known duplicate", () => {
  assert.equal(classifyLocalSubmittedProjects("https://www.99freelas.com.br/project/um-outro-slug-123456", ledger), "listed_submitted");
  assert.equal(classifyLocalSubmittedProjects("https://www.99freelas.com.br/project/exemplo-123457", ledger), "not_listed_unverified");
});

test("Windows PowerShell 5.1 UTF-8 BOM is accepted for an otherwise valid ledger", () => {
  assert.equal(classifyLocalSubmittedProjects(url, "\uFEFF" + ledger), "listed_submitted");
  assert.equal(classifyLocalSubmittedProjects(url, "\uFEFF" + "{invalid"), "invalid");
});

test("invalid registry always blocks drafting and does not leak source content", () => {
  for (const invalid of [
    "{",
    JSON.stringify({ schemaVersion: 2, submittedProjectUrls: [url] }),
    JSON.stringify({ schemaVersion: 1, submittedProjectUrls: ["https://evil.example/project/test"] }),
    JSON.stringify({ schemaVersion: 1, submittedProjectUrls: [url], password: "private" }),
    JSON.stringify({ schemaVersion: 1, submittedProjectUrls: Array(1001).fill(url) }),
  ]) assert.equal(classifyLocalSubmittedProjects(url, invalid), "invalid");
  const r = buildPublicProposalReview(project, input, "invalid");
  assert.equal(r.readiness, "local_registry_inconclusive");
  assert.equal(r.draft, null);
  assert.equal(r.duplicateStatus, "not_verified");
  assert.equal(r.duplicateGate, "INCONCLUSIVE");
  assert.equal(r.canSend, false);
  assert.equal(JSON.stringify(r).includes("private"), false);
});

test("missing opt-in keeps old public-preview behavior, never proves absence", async () => {
  assert.equal(await checkLocalSubmittedProjects(url, ""), "not_configured");
  assert.equal(await checkLocalSubmittedProjects(url, "relative/file.json"), "invalid");
  const r = buildPublicProposalReview(project, input);
  assert.equal(r.readiness, "manual_review_required");
  assert.equal(r.duplicateStatus, "not_verified");
  assert.equal(r.duplicateGate, "INCONCLUSIVE");
  assert.equal(r.localRegistryStatus, "not_configured");
});

test("Windows ledger cannot be redirected into the managed session or another path", () => {
  const appData = "C:\\Users\\Example\\AppData\\Local";
  const allowed = appData + "\\99FreelasMCP\\submitted-projects.json";
  assert.equal(isAllowedLocalSubmittedProjectsPath(allowed, "win32", appData), true);
  assert.equal(isAllowedLocalSubmittedProjectsPath(allowed.toUpperCase(), "win32", appData), true);
  assert.equal(isAllowedLocalSubmittedProjectsPath(appData + "\\99FreelasMCP\\session\\submitted-projects.json", "win32", appData), false);
  assert.equal(isAllowedLocalSubmittedProjectsPath(appData + "\\Google\\Chrome\\User Data\\submitted-projects.json", "win32", appData), false);
  assert.equal(isAllowedLocalSubmittedProjectsPath(appData + "\\99FreelasMCP\\session\\.99freelas-mcp-managed-session", "win32", appData), false);
  assert.equal(isAllowedLocalSubmittedProjectsPath("C:\\temp\\submitted-projects.json", "win32", appData), false);
  assert.equal(isAllowedLocalSubmittedProjectsPath(allowed, "win32", ""), false);
});

test("non-Windows local ledger requires a dedicated filename outside session", () => {
  assert.equal(isAllowedLocalSubmittedProjectsPath("/tmp/qa/submitted-projects.json", "linux"), true);
  assert.equal(isAllowedLocalSubmittedProjectsPath("/tmp/qa/session/submitted-projects.json", "linux"), false);
  assert.equal(isAllowedLocalSubmittedProjectsPath("/tmp/qa/chrome-profile.json", "linux"), false);
  assert.equal(isAllowedLocalSubmittedProjectsPath("relative/submitted-projects.json", "linux"), false);
});
