# Guia Técnico

## Stack

- Next.js 16.
- React 19.
- Supabase JS.
- Tailwind CSS.
- Lucide React.
- Node test runner.

## Estrutura

```text
app/
  api/
    auditoria/
    usuarios/
  chamada/
  colaboradores/
  login/
  resetar-senha/
  usuarios/
src/
  components/
  lib/
supabase/
  sql/
tests/
scripts/
docs/
```

## Bibliotecas Internas

`src/lib/supabase/client.ts`: cliente Supabase usado no navegador.

`src/lib/dates.ts`: data operacional em `America/Sao_Paulo` e geração de períodos.

`src/lib/password.ts`: validação de senha forte.

`src/lib/audit.ts`: cliente para enviar eventos à API de auditoria.

`src/lib/errors.ts`: mensagens genéricas para evitar vazamento de detalhes técnicos.

## APIs

### `POST /api/usuarios`

Cria usuário no Supabase Auth e cria profile no schema `gop_v2`.

Proteções:

- Requer token Bearer.
- Requer perfil admin ativo.
- Valida senha forte.
- Usa service role apenas no servidor.
- Registra auditoria.

### `PATCH /api/usuarios/senha`

Redefine senha de um usuário.

Proteções:

- Requer token Bearer.
- Requer perfil admin ativo.
- Valida senha forte.
- Registra auditoria.

### `GET /api/auditoria`

Lista eventos de auditoria.

Proteções:

- Requer token Bearer.
- Requer perfil admin ativo.
- Limite máximo de 200 registros.

Observação: não há aba visual de auditoria no app. Esta API fica disponível para suporte técnico ou uso futuro.

### `POST /api/auditoria`

Registra evento de auditoria.

Proteções:

- Requer token Bearer.
- Requer usuário ativo.
- Permite apenas entidades e ações conhecidas.
- Grava IP encaminhado e user-agent quando disponíveis.

## Segurança

O arquivo `next.config.ts` adiciona:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `X-Frame-Options: DENY`
- `poweredByHeader: false`

## Supabase

Scripts:

- `supabase/sql/001_security_audit_rls.sql`
- `supabase/sql/002_verify_security.sql`

O SQL cria:

- Função `gop_v2.hoje_brasil()`.
- Helpers de perfil.
- Tabela `gop_v2.audit_logs`.
- RLS nas tabelas principais.
- Policies por perfil.
- Grants para funções.

## Testes

```bash
npm run test
```

Cobertura atual:

- Timezone Brasil.
- Política de senha.
- Presença de RLS/auditoria no SQL versionado.
- Existência da tela de auditoria.

## Build e Qualidade

```bash
npm run lint
npm run build
```

## Verificação Remota do Supabase

```bash
npm run security:check
```

Esse script usa `.env.local` para validar:

- Função `gop_v2.hoje_brasil()`.
- Tabela `audit_logs`.
- Acesso a `profiles` com service role.
