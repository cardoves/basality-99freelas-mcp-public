import assert from "node:assert/strict";
import test from "node:test";
import { getPublicProfile, normalizeProfileUrl, parsePublicProfile } from "../dist/public-profile.js";

const URL = "https://www.99freelas.com.br/user/Basality";
const HTML = `<html><head><title>Basality | Freelancer | 99Freelas</title></head><body>
<div class="header-info-basicas"><h1>Basality</h1><p>Operações e integrações</p></div>
<div class="about-me description-content">Ajudamos pequenos negócios<br>com atendimento e vendas.</div>
<div class="professional-experience description-content">Integrações com APIs e rotinas operacionais.</div>
</body></html>`;

test("normalizes public profile URLs and strips tracking parameters", () => {
  assert.equal(normalizeProfileUrl("https://99freelas.com.br/user/Basality?fs=t").toString(), URL);
});

for (const input of [
  "https://evil.example/user/Basality",
  "http://www.99freelas.com.br/user/Basality",
  "https://www.99freelas.com.br/user/Basality/../../dashboard",
  "https://www.99freelas.com.br/profile/edit",
  "https://user:secret@www.99freelas.com.br/user/Basality",
  "https://www.99freelas.com.br:8443/user/Basality",
]) {
  test(`rejects unsafe or private profile URL: ${input}`, () => {
    assert.throws(() => normalizeProfileUrl(input));
  });
}

test("parses public profile identity and text fields", () => {
  assert.deepEqual(parsePublicProfile(HTML, URL), {
    url: URL,
    displayName: "Basality",
    professionalTitle: "Operações e integrações",
    about: "Ajudamos pequenos negócios com atendimento e vendas.",
    experienceSummary: "Integrações com APIs e rotinas operacionais.",
    source: "public-html",
  });
});

test("fails closed for pages with no verifiable profile header", () => {
  assert.throws(() => parsePublicProfile("<h1>Login</h1>", URL), /identity could not be verified/);
});

test("profile read makes one unauthenticated GET", async () => {
  let calls = 0;
  const fetchStub = async (_url, options) => {
    calls++;
    assert.equal(options.credentials, "omit");
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "manual");
    return new Response(HTML, { headers: { "content-type": "text/html" } });
  };
  const profile = await getPublicProfile(URL, fetchStub);
  assert.equal(calls, 1);
  assert.equal(profile.displayName, "Basality");
});

test("blocks redirects to authenticated or external pages", async () => {
  const fetchStub = async () => new Response(null, { status: 302, headers: { location: "/login" } });
  await assert.rejects(getPublicProfile(URL, fetchStub), /Redirect blocked/);
});
