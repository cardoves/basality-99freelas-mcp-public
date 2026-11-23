import { normalizeProjectUrl, type PublicProject } from "./public-project.js";
import type { LocalSubmittedStatus } from "./local-submitted-projects.js";

/** Substantive claims arrive as MCP input; this code cannot verify their human origin. */
export interface PublicProposalReviewInput {
  url: string;
  approach: string;
  clarifyingQuestion: string;
  signature?: string;
  amountBRL?: number;
  estimatedDays?: number;
}

export interface PublicProposalReview {
  mode: "public_preview_only";
  canSend: false;
  humanApprovalRequired: true;
  inputHumanVerified: false;
  project: PublicProject;
  readiness: "closed" | "insufficient_public_context" | "manual_review_required" | "known_duplicate" | "local_registry_inconclusive";
  publicAvailability: PublicProject["availability"];
  duplicateStatus: "not_verified" | "user_recorded_existing";
  duplicateGate: "INCONCLUSIVE" | "BLOCKED";
  localRegistryStatus: LocalSubmittedStatus;
  accountEligibility: "not_verified";
  offer: {
    amountBRL: number | null;
    estimatedDays: number | null;
    source: "caller_supplied";
    platformFeesVerified: false;
  };
  draft: string | null;
  reviewChecklist: string[];
  warnings: string[];
}

const contactPattern = /(?:https?:\/\/|\bwww\.|\b[^\s@]+@[^\s@]+\.[^\s@]+|(?:\+55\s*)?(?:\(\d{2}\)|\b\d{2})\s*9?\d{4}[- ]?\d{4}\b)/i;
const controlPattern = /[\u0000-\u0008\u000b-\u001f\u007f]/;
const compact = (value: string): string => value.replace(/\s+/g, " ").trim();

export function validatePublicProposalReviewInput(input: PublicProposalReviewInput): void {
  normalizeProjectUrl(input.url);
  for (const [name, raw, min, max] of [
    ["approach", input.approach, 40, 1400],
    ["clarifyingQuestion", input.clarifyingQuestion, 15, 280],
  ] as const) {
    if (typeof raw !== "string" || compact(raw).length < min || compact(raw).length > max ||
        controlPattern.test(raw) || contactPattern.test(raw)) {
      throw new Error(`Invalid ${name}: provide your own specific text without off-platform contacts or links.`);
    }
  }
  if (input.signature !== undefined && (
    typeof input.signature !== "string" || compact(input.signature).length > 80 ||
    controlPattern.test(input.signature) || contactPattern.test(input.signature)
  )) {
    throw new Error("Invalid signature: use a short name without contact details or links.");
  }
  if (input.amountBRL !== undefined && (
    !Number.isFinite(input.amountBRL) || input.amountBRL <= 0 || input.amountBRL > 10_000_000
  )) throw new Error("amountBRL must be a positive caller-supplied BRL amount pending human approval.");
  if (input.estimatedDays !== undefined && (
    !Number.isInteger(input.estimatedDays) || input.estimatedDays < 1 || input.estimatedDays > 365
  )) throw new Error("estimatedDays must be a caller-supplied integer from 1 to 365, pending human approval.");
}

/** An editable text preview, never a submitted bid or an inferred fit assessment. */
export function buildPublicProposalReview(
  project: PublicProject,
  input: PublicProposalReviewInput,
  localRegistryStatus: LocalSubmittedStatus = "not_configured",
): PublicProposalReview {
  validatePublicProposalReviewInput(input);
  if (project.url !== normalizeProjectUrl(input.url).toString()) {
    throw new Error("Requested URL does not match the fetched public project.");
  }
  const readiness = localRegistryStatus === "listed_submitted" ? "known_duplicate"
    : localRegistryStatus === "invalid" ? "local_registry_inconclusive"
      : project.availability === "closed" ? "closed"
        : !project.summary && !project.description ? "insufficient_public_context"
          : "manual_review_required";
  const draft = readiness !== "manual_review_required" ? null : [
    "Olá! Li a descrição pública do projeto e gostaria de entender melhor a necessidade.",
    compact(input.approach),
    `Antes de fechar o escopo, posso confirmar um ponto? ${compact(input.clarifyingQuestion)}`,
    `Se fizer sentido, podemos alinhar os próximos passos por aqui.${input.signature?.trim() ? `\n\n${compact(input.signature)}` : ""}`,
  ].join("\n\n");
  return {
    mode: "public_preview_only",
    canSend: false,
    humanApprovalRequired: true,
    inputHumanVerified: false,
    project,
    readiness,
    publicAvailability: project.availability,
    duplicateStatus: localRegistryStatus === "listed_submitted" ? "user_recorded_existing" : "not_verified",
    duplicateGate: localRegistryStatus === "listed_submitted" ? "BLOCKED" : "INCONCLUSIVE",
    localRegistryStatus,
    accountEligibility: "not_verified",
    offer: {
      amountBRL: input.amountBRL ?? null,
      estimatedDays: input.estimatedDays ?? null,
      source: "caller_supplied",
      platformFeesVerified: false,
    },
    draft,
    reviewChecklist: [
      "Conferir o escopo integral e a adequação à capacidade real da Basality.",
      "Verificar se o projeto ainda recebe propostas no momento da candidatura.",
      "Conferir manualmente se já existe uma proposta enviada para este projeto.",
      "A lista local é um registro declarado pelo usuário; não comprova ausência de proposta se o projeto não aparecer.",
      "Confirmar orçamento, prazo, taxas e conexões na própria conta antes de qualquer envio.",
      "Editar e aprovar pessoalmente o texto final; este MCP não pode enviar propostas.",
    ],
    warnings: [
      "O resumo público pode ser incompleto e não comprova os requisitos integrais.",
      project.availability === "closed"
        ? "Página pública indica projeto fechado: rascunho bloqueado."
        : project.availability === "unknown"
          ? "A página pública não comprova que o projeto ainda recebe propostas."
          : "A página pública indica aberto, mas o estado pode mudar; revalidar manualmente.",
      localRegistryStatus === "listed_submitted"
        ? "Projeto consta no registro local como já proposto; geração de novo rascunho bloqueada."
        : localRegistryStatus === "invalid"
          ? "Registro local configurado, mas ilegível ou inválido; geração de rascunho bloqueada."
          : "A ausência de um projeto na lista local não comprova ausência de proposta anterior.",
      "Nenhuma proposta foi enviada e nenhuma conexão foi consumida.",
    ],
  };
}
