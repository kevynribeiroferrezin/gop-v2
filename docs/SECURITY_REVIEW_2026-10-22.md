# Revisao de seguranca - 22/10/2026

Escopo: codigo local e recursos publicos de `https://gop-v2.vercel.app`.
Nao houve deploy, alteracao de tabelas/policies, criacao de contas, troca de senhas
ou alteracao de registros no Supabase publicado.

## Resultado no site publicado

- Sete telas e seus 16 bundles JavaScript iniciais inspecionados: JWT encontrado com papel
  `anon`; nenhuma chave `service_role` ou `sb_secret_` encontrada nesse conjunto.
  Isso nao equivale a uma busca em todos os chunks de todas as rotas.
- Os 16 source maps consultados retornaram HTTP 403.
- Criacao de usuario, redefinicao administrativa de senha e consulta de auditoria:
  seis requisicoes sem token/com token invalido receberam HTTP 401.
- Nove recursos Supabase consultados com a credencial publica, incluindo
  `profiles`, `funcionarios`, `presencas`, `audit_logs` e a view de funcionarios:
  todos receberam HTTP 401 com codigo PostgreSQL `42501` (permissao negada).
- OpenAPI anonimo retornou HTTP 401: nao foi possivel validar o formato completo
  das tabelas, as policies vigentes ou a definicao real das funcoes.

Esses resultados confirmam os bloqueios das requisicoes realizadas. Nao comprovam
isolamento entre usuarios autenticados no ambiente publicado. Nao foram usadas
contas reais ou feitas tentativas de adivinhacao de senha/carga.

## Correcoes implementadas no codigo local

1. Next.js 16.2.4 atualizado para 16.4.2, com ESLint Next correspondente e lockfile
   atualizado. O auditor npm inicialmente apontou 16 alertas, incluindo um critico.
2. Cliente privilegiado Supabase centralizado em modulo `server-only`, com
   autenticacao/checagem de perfil ativo compartilhada e validacao estrita de Bearer.
3. APIs validam tipos, limites, email, papel, UUID e regional. JSON invalido recebe
   400, conteudo incorreto recebe 415 e corpo acima de 16 KiB recebe 413, inclusive
   quando nao existe Content-Length. Senhas administrativas tem limite de 128 caracteres.
4. Redefinicao de senha exige que a conta alvo tenha perfil GOP. A chave privilegiada
   nao pode ser usada por esse endpoint para redefinir qualquer outra conta do Auth.
5. Relatos de auditoria enviados pelo navegador sao identificados como
   `relato_cliente`, `verificado: false`, com papeis/entidades permitidos. Detalhes
   livres, IP e User-Agent fornecidos pelo cliente nao sao persistidos. A consulta
   de auditoria nao devolve detalhes arbitrarios antigos. Relatos ainda podem ser
   inventados/omitidos por um usuario autenticado; nao constituem prova de mutacao.
6. Mensagens internas do banco removidas da interface. Respostas das consultas
   limitadas aos campos usados nas telas, inclusive nas chamadas RPC.
7. CSP com nonce novo por resposta, sobrescrevendo headers recebidos. Scripts
   inline sem nonce e eval bloqueados em producao. Paginas dinamicas e privadas,
   sem cache compartilhado. Cabecalhos contra framing e sniffing preservados.

IDs necessarios para editar registros e a URL/chave publica do Supabase continuam
visiveis no navegador. Um campo `value` ou uma requisicao pode ser inspecionado.
Excluir/renomear IDs nao impede acesso indevido: RLS e autorizacao precisam
validar o usuario, o registro e os relacionamentos no servidor/banco.
A reducao de campos nas consultas reduz a exposicao normal da interface; nao
substitui restricoes de acesso direto ao banco.

## Proposta do banco, nao aplicada

`supabase/sql/003_security_hardening.sql` e uma proposta para revisao, nao executada.
Nao modifica o formato das colunas, mas altera policies, grants, configuracao de
funcoes/views e instala triggers. Precisa ser validada com o formato real e em
homologacao antes de qualquer aplicacao. O pedido do usuario para nao alterar o
banco real permanece vigente.

Problemas identificados no SQL versionado, ainda nao confirmados no banco real:

- Presenca verifica `supervisor_id` informado, mas nao o vinculo de `funcionario_id`
  com o supervisor. A proposta verifica ambos, inclusive na atualizacao.
- Policies antigas com nomes desconhecidos podem se somar por OR as novas.
- `get_chamada_por_data` nao tem definicao no repositorio: SECURITY DEFINER pode
  contornar RLS. A proposta troca para INVOKER e restringe grants de outras RPCs.
  Dependencias internas da funcao real precisam ser revisadas antes disso.
- Perfis inativos ainda podem consultar os catalogos no SQL antigo.
- Auditoria operacional depende de relato do cliente. A proposta registra mutacoes
  atomicamente por triggers, sem copiar dados pessoais para detalhes.
- Autor do fechamento pode ser informado arbitrariamente pelo navegador.

`supabase/sql/004_inspect_security_readonly.sql` consulta somente metadados,
policies e grants, em transacao READ ONLY. Pode ser usado em uma conexao
administrativa autorizada para concluir a revisao. Nao ha credenciais locais nem
conector Supabase administrativo disponivel nesta sessao.

## Validacao local

- `npm run lint`: passou.
- `npm test`: 22 testes passaram. Incluem endpoints reais com provedor simulado e
  PostgreSQL em memoria (PGlite) para ataques entre equipes, elevacao de privilegio,
  contas inativas, RPC/view, adulteracao de autor e protecao dos logs.
- A integracao PostgreSQL usa fixtures locais; nao reproduz a definicao real da
  RPC nem certifica o esquema publicado.
- `npm run build`: passou com credenciais ficticias; nenhuma credencial de
  producao foi necessaria. Todas as paginas renderizam por requisicao para o nonce.
- `npm run security:runtime`: passou contra build local em `127.0.0.1:3100`:
  7 respostas HTML com nonce aplicado em todos os scripts, nonce diferente por
  resposta e imune a headers forjados; 4 APIs negadas sem token; 4 caminhos privados
  (`.env`, `.env.local`, `.git/config`, `package.json`) com 404; 20 assets sem source
  maps e sem o marcador usado como chave de servidor no build de teste.
- `npm run security:public -- https://gop-v2.vercel.app`: passou nas verificacoes
  limitadas descritas acima. Script nao imprime chaves ou registros recebidos.
- `npm audit --omit=dev`: zero vulnerabilidades conhecidas.
- `npm audit`: cinco alertas HIGH na cadeia de desenvolvimento
  `eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces`.
  O npm nao indicou correcao compativel; o `--force` sugeriu downgrade para Next
  ESLint 14, que nao foi aplicado. Esse risco permanece nas ferramentas de lint.

Para repetir o teste de runtime, gerar build com os valores ficticios acima,
iniciar `next start --hostname 127.0.0.1 --port 3100` e executar
`npm run security:runtime`. Nao usar dados reais para o teste do marcador.

## Pendencias

Falta publicar as correcoes do codigo e repetir as verificacoes depois do deploy.
Acesso administrativo somente de leitura e contas de teste de cada papel sao
necessarios para confirmar o esquema e o isolamento no Supabase real. Controles
do provedor como limites de login/recuperacao, cadastro publico, MFA, redirect
allowlist e revogacao de sessoes nao foram inspecionados nesta sessao.

## Referencias consultadas

- [Aviso Next.js de outubro e versoes corrigidas](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw).
- [Aviso de desserializacao em use cache](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr).
- [Supabase: RLS e views](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Supabase: permissoes de funcoes](https://supabase.com/docs/guides/database/functions).
- [Braces: alerta ainda sem correcao compativel](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- Guias locais da versao instalada em `node_modules/next/dist/docs/`:
  Route Handlers, Data Security, Proxy, Content Security Policy e Headers.
