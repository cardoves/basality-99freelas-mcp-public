import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicProposalReview, validatePublicProposalReviewInput,
} from "../dist/public-proposal-review.js";
import { getPublicProject } from "../dist/public-project.js";

const url = "https://www.99freelas.com.br/project/organizacao-de-atendimento-123456";
const input = {
  url,
  approach: "Podemos organizar o fluxo de entrada dos pedidos, definir respostas claras e revisar os retornos que hoje ficam sem acompanhamento.",
  clarifyingQuestion: "Hoje os contatos chegam por quais canais e quem acompanha cada retorno?",
  signature: "Equipe Basality",
};
const base = {
  url, title: "Organização do atendimento", summary: "Preciso reduzir retrabalho no atendimento da equipe.",
  availability: "unknown", source: "public-html",
};

test("public preview uses only caller-supplied approach and never authorizes a send", () => {
  const result = buildPublicProposalReview(base, { ...input, amountBRL: 900, estimatedDays: 12 });
  assert.equal(result.mode, "public_preview_only");
  assert.equal(result.canSend, false);
  assert.equal(result.humanApprovalRequired, true);
  assert.equal(result.inputHumanVerified, false);
  assert.equal(result.readiness, "manual_review_required");
  assert.equal(result.duplicateStatus, "not_verified");
  assert.equal(result.accountEligibility, "not_verified");
  assert.equal(result.offer.amountBRL, 900);
  assert.equal(result.offer.estimatedDays, 12);
  assert.equal(result.offer.platformFeesVerified, false);
  assert.ok(result.draft.includes(input.approach));
  assert.ok(result.draft.includes(input.clarifyingQuestion));
  assert.ok(result.draft.includes(input.signature));
  assert.ok(result.reviewChecklist.some(line => /já existe uma proposta/i.test(line)));
  assert.ok(result.warnings.some(line => /não comprova/i.test(line)));
  assert.equal("submit" in result, false);
});

test("closed projects and missing public summary never get a proposal draft", () => {
  const closed = buildPublicProposalReview({ ...base, availability: "closed" }, input);
  assert.equal(closed.readiness, "closed");
  assert.equal(closed.draft, null);
  const sparse = buildPublicProposalReview({ ...base, summary: null, availability: "open" }, input);
  assert.equal(sparse.readiness, "insufficient_public_context");
  assert.equal(sparse.draft, null);
});

test("a closed button on a public project prevents a proposal draft", async () => {
  const fetchStub = async () => new Response(
    '<h1>Projeto</h1><meta name="description" content="Contexto público"/><div class="box-project-view-info"><button>Fechado</button></div>',
    { headers: { "content-type": "text/html" } },
  );
  const project = await getPublicProject(url, fetchStub);
  const result = buildPublicProposalReview(project, input);
  assert.equal(result.publicAvailability, "closed");
  assert.equal(result.readiness, "closed");
  assert.equal(result.draft, null);
});

test("a public description can supply context when summary metadata is absent", () => {
  const result = buildPublicProposalReview({ ...base, summary: null, description: "Necessidade descrita publicamente." }, input);
  assert.equal(result.readiness, "manual_review_required");
  assert.ok(result.draft);
});

test("public project and review URL must match canonical IDs", () => {
  assert.throws(() => buildPublicProposalReview({ ...base, url: "https://www.99freelas.com.br/project/other-123456" }, input), /does not match/);
  assert.throws(() => validatePublicProposalReviewInput({ ...input, url: "https://evil.example/project/test-12" }), /99Freelas/);
});

test("the draft refuses unverified personal contacts and invalid human offers", () => {
  for (const approach of [
    "Veja https://example.com como contato externo para seu projeto; podemos fazer um orçamento.",
    "Meu e-mail teste@example.invalid pode receber sua resposta para este projeto.",
    "Atendemos esse escopo. Telefone (00) 90000-0000 para conversarmos sobre a proposta.",
  ]) assert.throws(() => validatePublicProposalReviewInput({ ...input, approach }), /Invalid approach/);
  assert.throws(() => validatePublicProposalReviewInput({ ...input, clarifyingQuestion: "Você prefere?\u0000" }), /Invalid clarifyingQuestion/);
  assert.throws(() => validatePublicProposalReviewInput({ ...input, signature: "https://site.example" }), /Invalid signature/);
  assert.throws(() => validatePublicProposalReviewInput({ ...input, amountBRL: -200 }), /amountBRL/);
  assert.throws(() => validatePublicProposalReviewInput({ ...input, estimatedDays: 1.5 }), /estimatedDays/);
});

test("a proposal preview requires one public GET with omitted credentials", async () => {
  let count = 0;
  const stub = async (requestUrl, opts) => {
    count++;
    assert.equal(opts.method, "GET");
    assert.equal(opts.credentials, "omit");
    assert.equal(opts.redirect, "manual");
    assert.equal(requestUrl.toString(), url);
    return new Response('<h1>Organização do atendimento</h1><meta name="description" content="Preciso organizar o atendimento"/>', {
      headers: { "content-type": "text/html" },
    });
  };
  const project = await getPublicProject(url, stub);
  const preview = buildPublicProposalReview(project, input);
  assert.equal(count, 1);
  assert.equal(preview.canSend, false);
  assert.ok(preview.draft);
  assert.equal(preview.project.summary, "Preciso organizar o atendimento");
});
