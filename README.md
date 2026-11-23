# Basality 99Freelas MCP

**Português** | [English](#english)

Servidor MCP independente e não oficial, sem afiliação com o 99Freelas. Consulta uma página pública de projeto ou perfil por URL e prepara texto de proposta para revisão humana. Não descobre oportunidades, acessa contas, lê sessões ou cookies, edita perfis, envia mensagens ou propostas, nem consome conexões.

Requer Node.js 22 ou posterior e acesso à internet. A estrutura pública do site pode mudar ou bloquear acessos automatizados; use a ferramenta em conformidade com as regras aplicáveis da plataforma.

Ferramentas: `system_health`, `projects_get_public`, `profile_get_public` e `proposals_prepare_public_review`. A prévia retorna `canSend=false`; disponibilidade, elegibilidade e proposta anterior podem permanecer não verificadas. Texto fornecido pelo cliente MCP precisa de revisão humana.

### Instalação

Após a publicação no npm:

```sh
npm install -g basality-99freelas-mcp
```

Alternativa pelo código publicado, com Git e Node.js instalados:

```sh
npm install -g git+https://github.com/cardoves/basality-99freelas-mcp-public.git#v0.1.0
```

No Codex ou outro cliente MCP compatível com stdio, configure o executável instalado como comando, sem argumentos. Exemplo de configuração JSON:

```json
{ "mcpServers": { "99freelas-public": { "command": "basality-99freelas-mcp", "args": [] } } }
```

No Windows, caso o cliente não execute o comando npm global diretamente, use `cmd` com `args` iguais a `["/c", "basality-99freelas-mcp"]`. O servidor usa stdio local; não é um endpoint remoto nem uma integração remota nativa do ChatGPT.

Exemplo de chamada no cliente MCP:

```json
{"name":"projects_get_public","arguments":{"url":"https://www.99freelas.com.br/project/automacao-de-whatsapp-com-ia-uchat-n8n-798358"}}
```

As chamadas de leitura enviam a URL pública ao site sem cookies. Os dados retornados passam ao cliente MCP; não inclua informações confidenciais nas entradas. Opcionalmente, `FREELAS_SUBMITTED_PROJECTS_FILE` pode apontar para um registro local mantido pelo usuário. Esse arquivo é apenas lido; ausência na lista não prova ausência de proposta anterior. No Windows o caminho aceito é `%LOCALAPPDATA%\99FreelasMCP\submitted-projects.json`; em outros sistemas deve ser um arquivo absoluto com esse nome fora de diretórios `session`.

## English

An independent, unofficial MCP server, not affiliated with 99Freelas. Reads one public project or profile URL and prepares an unsent proposal draft for human review. It does not discover projects, sign in, read browser sessions or cookies, edit profiles, send messages or proposals, or consume connections.

Requires Node.js 22 or newer and internet access. The public website may change or block automated requests; comply with the platform's applicable rules. The four tools are `system_health`, `projects_get_public`, `profile_get_public`, and `proposals_prepare_public_review`. Previews return `canSend=false`; availability, eligibility and prior proposals may remain unverified.

Install with `npm install -g basality-99freelas-mcp` after publication, or install from the GitHub tag using the command above. Configure `basality-99freelas-mcp` as the stdio command in a compatible MCP client. On Windows, if the npm command shim cannot be launched directly, use `cmd` with `["/c", "basality-99freelas-mcp"]`. This is a local stdio server, not a remote ChatGPT integration.

Requests send the public URL to the website without cookies, and the result is delivered to the MCP client. Avoid putting confidential information in inputs. The optional `FREELAS_SUBMITTED_PROJECTS_FILE` is read-only and user-maintained; an absent entry does not prove no prior submission. On Windows the allowed file is `%LOCALAPPDATA%\99FreelasMCP\submitted-projects.json`; elsewhere it must be an absolute path to a file with that name outside `session` directories.

MIT License. The copyright notice in [LICENSE](LICENSE) is preserved.
