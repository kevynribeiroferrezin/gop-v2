# Guia de Acesso e Testes do GOP V2

## URL do sistema

Preencha aqui a URL do ambiente que sera testado:

`URL: https://gop-v2.vercel.app/ `

## Dados de login

Use o usuario administrador abaixo para acessar o sistema e testar todas as funcionalidades disponiveis:

- E-mail: `supervisor.teste@empresa.com`
- Senha: `admin`

## Como entrar no sistema

1. Acesse a URL do sistema no navegador.
2. Se o sistema nao abrir direto na tela de login, clique ou navegue para `/login`.
3. Informe o e-mail `supervisor.teste@empresa.com`.
4. Informe a senha `admin`.
5. Clique no botao de entrar.

Apos o login, o sistema abre o Dashboard. No computador, as abas ficam no menu lateral esquerdo. No celular, elas aparecem na barra inferior com icones.

## Abas do sistema

### Dashboard

A aba Dashboard e a tela inicial do sistema. Ela mostra um resumo do dia com os principais numeros da chamada:

- Presentes hoje.
- Faltas hoje.
- Atrasos hoje.
- Colaboradores ativos.
- Presencas lancadas.
- Chamadas pendentes.
- Folgas, ferias e atestados.

Use essa tela para conferir se os lancamentos feitos na chamada estao refletindo nos indicadores gerais.

### Chamada

A aba Chamada serve para registrar a presenca diaria dos colaboradores.

Como testar:

1. Acesse a aba `Chamada`.
2. Escolha a data da chamada no campo de data.
3. Selecione o supervisor no filtro da lista.
4. Confira os colaboradores exibidos.
5. Por padrao, todos comecam como `Presente`.
6. Marque excecoes quando necessario: `Falta`, `Atraso`, `Atestado`, `Folga`, `Ferias` ou `Afastado`.
7. Se quiser, escreva uma observacao no campo do colaborador.
8. Clique em `Salvar alteracoes`.
9. Para encerrar a chamada daquele supervisor e daquela data, clique em `Finalizar chamada`.

Para testar ferias, clique em `Ferias` em um colaborador, selecione a data inicial e final, depois confirme. O sistema registra ferias para todos os dias do periodo escolhido.

### Colaboradores

A aba Colaboradores concentra o cadastro base dos funcionarios.

Como testar:

1. Acesse a aba `Colaboradores`.
2. Use a busca para procurar por nome, matricula, cargo ou supervisor.
3. Clique em `Novo colaborador` para cadastrar um funcionario.
4. Preencha matricula, nome, cargo, supervisor, regional, data de admissao, status e observacao quando necessario.
5. Salve o cadastro e confirme se ele aparece na lista.
6. Clique em `Editar` em um colaborador existente para alterar dados.
7. Use `Inativar` ou `Ativar` para testar a mudanca de status.

Depois de cadastrar ou alterar um colaborador, volte ao Dashboard ou a Chamada para validar se os dados aparecem corretamente nas demais telas.

### Usuarios

A aba Usuarios fica disponivel para o perfil administrador. Ela permite controlar quem acessa o sistema.

Como testar:

1. Acesse a aba `Usuarios`.
2. Use a busca para procurar por nome, e-mail ou perfil.
3. Clique em `Novo usuario` para criar um acesso.
4. Preencha nome, e-mail, senha, confirmacao de senha e perfil.
5. Se o perfil escolhido for `Supervisor`, informe tambem o codigo do supervisor.
6. Salve e confirme se o usuario aparece na lista.
7. Clique em `Editar` para alterar nome, perfil, status ou redefinir senha.
8. Use `Inativar` ou `Ativar` para testar o bloqueio/liberacao de acesso.

Os perfis disponiveis sao:

- `Administrador`: acessa Dashboard, Chamada, Colaboradores e Usuarios.
- `RH`: acessa Dashboard e Colaboradores.
- `Supervisor`: acessa Dashboard, Chamada e Colaboradores.

## Sair do sistema

Para encerrar o teste, clique no botao `Sair`. No computador, ele fica no final do menu lateral. No celular, ele fica na barra inferior.

## Roteiro rapido de validacao

Use este checklist para confirmar que as principais funcionalidades foram testadas:

- Login com `supervisor.teste@empresa.com`.
- Visualizacao do Dashboard.
- Alteracao de data na Chamada.
- Lancamento de falta, atraso, atestado, folga, ferias ou afastamento.
- Salvamento da chamada.
- Finalizacao da chamada.
- Busca de colaboradores.
- Cadastro de novo colaborador.
- Edicao de colaborador.
- Ativacao ou inativacao de colaborador.
- Busca de usuarios.
- Cadastro de novo usuario.
- Edicao de usuario.
- Ativacao ou inativacao de usuario.
- Logout pelo botao `Sair`.
