import { load } from "cheerio";
import { fetchPublicHtml } from "./public-http.js";

export interface PublicProfile {
  url: string;
  displayName: string;
  professionalTitle: string | null;
  about: string | null;
  experienceSummary: string | null;
  source: "public-html";
}

const PROFILE_PATH_PATTERN = /^\/user\/[a-zA-Z0-9_-]+\/?$/;
const ALLOWED_HOSTS = new Set(["99freelas.com.br", "www.99freelas.com.br"]);

export function normalizeProfileUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Invalid profile URL.");
  }
  if (
    url.protocol !== "https:" ||
    !ALLOWED_HOSTS.has(url.hostname.toLowerCase()) ||
    url.port || url.username || url.password ||
    !PROFILE_PATH_PATTERN.test(url.pathname)
  ) {
    throw new Error("Only public HTTPS 99Freelas profile URLs are allowed.");
  }
  url.hostname = "www.99freelas.com.br";
  url.search = "";
  url.hash = "";
  return url;
}

function cleanText(text: string | null | undefined): string | null {
  return text?.replace(/\s+/g, " ").trim() || null;
}

export function parsePublicProfile(html: string, url: string): PublicProfile {
  const $ = load(html);
  const displayName = cleanText($("h1").first().text());
  if (!displayName || !$(".header-info-basicas").length) {
    throw new Error("Profile identity could not be verified from the public page.");
  }
  const professionalTitle = cleanText($(".header-info-basicas h1 + p").first().text());
  const sectionText = (selector: string): string | null => {
    const sectionHtml = $(selector).first().html();
    if (sectionHtml === null) return null;
    const withSpacing = sectionHtml.replace(/<br\s*\/?>|<\/p>|<\/div>/gi, " ");
    return cleanText(load(`<section>${withSpacing}</section>`)("section").text());
  };
  const about = sectionText(".about-me.description-content");
  const experienceSummary = sectionText(".professional-experience.description-content");

  return { url, displayName, professionalTitle, about, experienceSummary, source: "public-html" };
}

export async function getPublicProfile(
  input: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PublicProfile> {
  const url = normalizeProfileUrl(input);
  const html = await fetchPublicHtml(url, fetchImpl);
  return parsePublicProfile(html, url.toString());
}
