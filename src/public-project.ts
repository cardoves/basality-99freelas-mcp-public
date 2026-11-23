import { load } from "cheerio";
import { fetchPublicHtml } from "./public-http.js";

export type ProjectAvailability = "open" | "closed" | "unknown";

export interface PublicProject {
  url: string;
  title: string;
  summary: string | null;
  description?: string | null;
  availability: ProjectAvailability;
  source: "public-html";
}

const PROJECT_PATH_PATTERN = /^\/project\/[a-zA-Z0-9-]+(?:\/)?$/;
const ALLOWED_HOSTS = new Set(["99freelas.com.br", "www.99freelas.com.br"]);

export function normalizeProjectUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Invalid project URL.");
  }
  if (
    url.protocol !== "https:" ||
    !ALLOWED_HOSTS.has(url.hostname.toLowerCase()) ||
    url.port ||
    url.username ||
    url.password ||
    !PROJECT_PATH_PATTERN.test(url.pathname) ||
    /^\/project\/new\/?$/i.test(url.pathname)
  ) {
    throw new Error("Only public HTTPS 99Freelas project URLs are allowed.");
  }
  url.hostname = "www.99freelas.com.br";
  url.search = "";
  url.hash = "";
  return url;
}

function normalizeText(value: string | undefined | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeDescription(value: string | undefined | null): string {
  // Some public pages embed HTML break tags inside the meta description.
  // Parse the inert fragment as text before exposing it to MCP clients.
  const fragment = (value ?? "").replace(/<br\s*\/?>/gi, "\n");
  return normalizeText(load(`<div>${fragment}</div>`)("div").text());
}

export function parsePublicProject(html: string, url: string): PublicProject {
  const $ = load(html);
  const h1 = normalizeText($("h1").first().text());
  const metaTitle = normalizeText($("meta[property='og:title']").attr("content"));
  const rawTitle = h1 || metaTitle || normalizeText($("title").first().text());
  const title = rawTitle.replace(/\s*[|–-]\s*(Projeto\s*[|–-]\s*)?99Freelas\s*$/i, "");
  if (!title) {
    throw new Error("Project title could not be verified from the public page.");
  }

  const summary = normalizeDescription(
    $("meta[property='og:description']").attr("content") ||
      $("meta[name='description']").attr("content"),
  );
  const descriptionNode = $(".project-description");
  let description: string | null = null;
  if (descriptionNode.length === 1) {
    const content = descriptionNode.clone();
    content.find("script, style, noscript").remove();
    const htmlContent = content.html();
    description = normalizeDescription(htmlContent) || null;
  }
  // Only an explicit project status is treated as definitive. No inferred "open" status.
  const statusLabels = $("[data-project-status], .project-status, .status-projeto, .box-project-view-info button")
    .map((_, element) => normalizeText($(element).text() || $(element).attr("data-project-status")))
    .get();
  const availability: ProjectAvailability = statusLabels.some((label) => /^(fechado|encerrado|concluído)$/i.test(label))
    ? "closed"
    : statusLabels.some((label) => /^(aberto|recebendo propostas)$/i.test(label))
      ? "open"
      : "unknown";

  return {
    url,
    title,
    summary: summary || null,
    description,
    availability,
    source: "public-html",
  };
}

export async function getPublicProject(
  input: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PublicProject> {
  const url = normalizeProjectUrl(input);
  const html = await fetchPublicHtml(url, fetchImpl);
  return parsePublicProject(html, url.toString());
}
