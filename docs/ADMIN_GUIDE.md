# Manual Administrativo

## Gestão de Usuários

A tela `/usuarios` é restrita ao perfil admin.

O admin pode:

- Cadastrar usuário.
- Editar nome, perfil e status.
- Redefinir senha.
- Ativar ou inativar acesso.
- Vincular supervisor por código.

## Regras de Senha

A senha precisa ter:

- Pelo menos 10 caracteres.
- Uma letra minúscula.
- Uma letra maiúscula.
- Um número.
- Um caractere especial.

## Perfis

**Admin:** acesso completo.

**RH:** dashboard e colaboradores.

**Supervisor:** dashboard, chamada e colaboradores.

## Auditoria Interna

O sistema registra eventos críticos internamente na tabela `audit_logs`, como:

- Criação de usuário.
- Atualização de usuário.
- Ativação/inativação de usuário.
- Redefinição de senha.
- Criação/edição/inativação de colaborador.
- Salvamento de chamada.
- Lançamento de férias.
- Finalização de chamada.

Campos registrados:

- Data e hora.
- Ator.
- Papel do ator.
- Ação.
- Entidade.
- ID da entidade.
- Detalhes do evento.

## Ações Sensíveis

O sistema pede confirmação antes de:

- Salvar alterações de chamada.
- Lançar férias.
- Finalizar chamada.
- Editar usuário com impacto administrativo.
- Ativar ou inativar usuários e colaboradores.

## Conferência de Produção

Antes de liberar o sistema:

1. Aplicar SQL de segurança.
2. Rodar SQL de verificação.
3. Rodar `npm run security:check`.
4. Testar login com admin, RH e supervisor.
5. Fazer uma chamada de teste.
6. Conferir no Supabase se a tabela `audit_logs` registrou os eventos.
