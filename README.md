# GOP V2

Sistema interno para controle de presença, colaboradores, usuários e auditoria.

O GOP V2 foi construído com Next.js, React e Supabase. Ele atende um fluxo operacional simples: manter a base de colaboradores, registrar chamadas por supervisor, acompanhar o resumo diário e auditar alterações críticas.

## Funcionalidades

- Login e recuperação de senha via Supabase Auth.
- Dashboard com resumo diário de presença.
- Chamada diária por supervisor.
- Lançamento de exceções: falta, atraso, atestado, folga, férias e afastamento.
- Finalização de chamada.
- Cadastro e edição de colaboradores.
- Cadastro, edição, ativação e inativação de usuários.
- Controle de acesso por perfil: admin, RH e supervisor.
- Auditoria interna de alterações críticas.
- Data operacional padronizada para `America/Sao_Paulo`.
- Scripts de validação, build e checagem de segurança.

## Perfis

| Perfil | Acesso |
| --- | --- |
| Admin | Dashboard, chamada, colaboradores e usuários |
| RH | Dashboard e colaboradores |
| Supervisor | Dashboard, chamada e colaboradores |

## Rotas

| Rota | Descrição |
| --- | --- |
| `/login` | Entrada no sistema e solicitação de recuperação de senha |
| `/resetar-senha` | Criação de nova senha após recuperação |
| `/` | Dashboard geral |
| `/chamada` | Registro e finalização da chamada |
| `/colaboradores` | Cadastro base de colaboradores |
| `/usuarios` | Gestão de usuários, apenas admin |
| `/acesso-negado` | Tela de bloqueio por perfil inválido |

## Requisitos

- Node.js compatível com Next.js 16.
- Projeto Supabase configurado.
- Variáveis em `.env.local`.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Instalação

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run lint
npm run test
npm run build
npm run security:check
```

`npm run security:check` valida se pontos essenciais existem no Supabase real. Ele depende das variáveis do `.env.local`.

## Supabase

Antes de produção, execute os SQLs:

1. `supabase/sql/001_security_audit_rls.sql`
2. `supabase/sql/002_verify_security.sql`

O primeiro cria/ajusta funções, auditoria, timezone e policies. O segundo ajuda a conferir se o banco ficou pronto.

## Documentação

- [Visão Geral](docs/OVERVIEW.md)
- [Manual do Usuário](docs/USER_GUIDE.md)
- [Guia de Acesso e Testes](docs/TEST_GUIDE.md)
- [Manual Administrativo](docs/ADMIN_GUIDE.md)
- [Arquitetura e Segurança](docs/TECHNICAL_GUIDE.md)
- [Checklist de Produção](docs/PRODUCTION_READINESS.md)
