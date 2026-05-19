# GOP V2 - Checklist de produção

Use este checklist antes de considerar o ambiente como produção.

## Supabase

1. Execute `supabase/sql/001_security_audit_rls.sql` no SQL Editor.
2. Execute `supabase/sql/002_verify_security.sql` e confirme:
   - `rls_enabled = true` para todas as tabelas listadas.
   - Existem policies para `profiles`, `funcionarios`, `presencas`, `fechamentos_chamada`, `cargos`, `regionais`, `supervisores` e `audit_logs`.
   - `gop_v2.hoje_brasil()` retorna a data correta em `America/Sao_Paulo`.
   - `audit_logs_existe = true`.
3. Rode localmente `npm run security:check`.

## Vercel

Configure as variáveis:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no navegador.

## Validação

Rode:

```bash
npm run lint
npm run test
npm run build
npm run security:check
```

## Fluxos manuais mínimos

- Admin cria usuário com senha forte.
- Admin altera perfil/status de usuário.
- Admin executa ações críticas e a tabela `audit_logs` registra os eventos.
- RH cria/edita/inativa colaborador.
- Supervisor salva chamada, lança férias e finaliza chamada.
- Dashboard mostra a data correta antes e depois da meia-noite em `America/Sao_Paulo`.
