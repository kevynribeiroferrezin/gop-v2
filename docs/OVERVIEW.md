# Visão Geral

O GOP V2 é um sistema interno de gestão de presença. Ele organiza quatro áreas principais:

- Dashboard diário.
- Chamada de colaboradores.
- Cadastro base de colaboradores.
- Gestão de acessos.

## Objetivo

Reduzir o trabalho manual no controle diário de presença, mantendo uma base única de colaboradores e permitindo que supervisores registrem apenas exceções. Por padrão, o sistema considera todos como presentes; o usuário marca somente quem teve falta, atraso, atestado, folga, férias ou afastamento.

## Conceitos

**Colaborador:** pessoa acompanhada na chamada.

**Supervisor:** usuário ou pessoa responsável por um grupo de colaboradores.

**Chamada:** registro diário de presença por supervisor.

**Exceção:** qualquer status diferente de presente.

**Fechamento:** marcação de que a chamada daquele supervisor naquela data foi finalizada.

**Auditoria:** trilha de ações importantes feitas no sistema.

## Perfis

**Admin:** gerencia usuários, faz chamada e gerencia colaboradores.

**RH:** gerencia colaboradores e consulta dashboard.

**Supervisor:** faz chamada e consulta colaboradores.

## Fluxo Diário

1. Usuário acessa o sistema.
2. Entra em `Chamada`.
3. Seleciona a data.
4. Escolhe o supervisor.
5. Marca apenas exceções.
6. Salva alterações.
7. Finaliza a chamada.
8. Dashboard reflete os totais e pendências.

## Segurança

O app usa:

- Supabase Auth.
- Controle de tela por perfil.
- RLS/policies versionadas em SQL.
- Senha forte.
- Headers básicos de segurança no Next.js.
- Auditoria interna de alterações críticas.
- Timezone fixo em `America/Sao_Paulo`.
