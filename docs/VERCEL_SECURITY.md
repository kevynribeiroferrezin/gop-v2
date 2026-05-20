# Vercel e seguranca

## Deploy na Vercel

O projeto inclui `vercel.json` para deploy como Next.js usando `npm ci` e `npm run build`.

Configure na Vercel:

- Root Directory: `gop-v2`.
- Framework Preset: Next.js.
- Install Command: `npm ci`.
- Build Command: `npm run build`.
- `NEXT_PUBLIC_SUPABASE_URL`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY`.

Use `.env.example` como modelo local.

## Bloqueio por inspecionar elemento

A `NEXT_PUBLIC_SUPABASE_ANON_KEY` aparece no navegador por design no Supabase. Ela nao deve ter poder administrativo. A seguranca real fica nas policies RLS e nas rotas server-side.

- `SUPABASE_SERVICE_ROLE_KEY` fica apenas no servidor.
- Criacao de usuario e redefinicao de senha passam por `/api`.
- Supervisores so podem consultar/escrever registros do proprio `supervisor_id`.
- RH e admin podem consultar colaboradores; escrita de colaboradores fica em RH/admin.
- APIs respondem com `Cache-Control: no-store`.
- Headers incluem CSP, HSTS, `X-Frame-Options`, `nosniff` e referrer policy.

## Checklist antes do deploy

```bash
npm run lint
npm run test
npm run build
npm run security:check
```

No Supabase, execute:

1. `supabase/sql/001_security_audit_rls.sql`
2. `supabase/sql/002_verify_security.sql`

Confirme que `current_supervisor_id_existe = true`, RLS esta ativo nas tabelas listadas e os provedores de login nao usados estao desabilitados no Supabase Auth.
