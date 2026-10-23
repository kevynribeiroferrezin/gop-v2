# Coordenação, colaboradores e relatórios

Solicitação autorizada em 22/10/2026. A integração Supabase foi localizada, mas
ainda não havia conexão administrativa confirmada durante a implementação.
O código e a migração estão preparados; aplicação e validação no banco publicado
dependem dessa conexão. Os testes PostgreSQL usam fixtures locais.

## Dados e responsabilidades

### Ocorrências e fechamento definitivo (007)

O ajuste de **período**, distinto da alteração de um único registro, está na
`009_alterar_periodo_ferias.sql` (aplicar após 007 e 008). Somente admin vê a ação
“Alterar período de férias”. Ela consulta o intervalo contínuo de férias que
contém a data selecionada e preenche as datas reais no formulário.

Ao salvar, a substituição é atômica: remove os dias retirados, insere os novos e
mantém os dias da interseção sem atualizar seus registros. Por isso é possível
ajustar dias abertos de um período parcialmente fechado, desde que nenhum dia
finalizado seja removido. Novas datas com chamada finalizada ou outros registros
são recusadas, sem sobrescrever ocorrências. Um token do conjunto original
impede salvar uma edição baseada em dados alterados por outra sessão.
Os limites do intervalo são derivados dos dias contínuos registrados; períodos
adjacentes sem interrupção aparecem como um único intervalo, mostrado antes de
confirmar. Não há inferência das datas a partir do texto da observação.
Esta migração ainda não foi aplicada ao Supabase publicado nesta sessão, por
ausência de conexão administrativa.

A migração `007_ocorrencias_travas_chamada.sql` adiciona campos independentes em
`presencas`: `falta_justificada`, `falta_motivo`, `atraso_motivo`, `atraso_detalhe`,
`atraso_tem_atestado`, `atestado_cid`, `folga_tipo` e `afastamento_motivo`.
Não preenche motivos históricos nem inventa CID. CID é opcional quando não
consta no documento e não é incluído nas exportações gerais nem na auditoria.

Falta exige sim/não; se justificada, exige motivo. Atraso exige transporte,
compromisso, médico ou outro; médico exige sim/não para atestado, com CID
opcional se houver documento. Outro exige descrição. Folga exige escala,
banco de horas ou feriado. Afastamento exige motivo. Trocar status limpa os
campos que deixam de ser pertinentes.

Férias já gravadas só podem ser atualizadas, trocadas ou excluídas por admin,
enquanto a chamada estiver aberta. Fechamentos não podem ser atualizados ou excluídos e bloqueiam
inserções, alterações e exclusões de presenças da mesma equipe/data.
Se a 007 já foi aplicada, a `008_ferias_edicao_admin.sql` atualiza essa permissão
sem alterar dados nem liberar chamadas finalizadas. Também é seguro aplicá-la
após a versão atual da 007.
As travas são triggers, aplicadas também a tentativas diretas via API.
Locks transacionais por equipe/data serializam escritas e fechamento.

`salvar_chamada` grava as alterações e, ao finalizar, materializa presenças
padrão e fecha a equipe na mesma transação. Falhas revertem o lote completo.
`registrar_ferias` grava o período de uma vez; sobreposição com fechamento
rejeita o período inteiro. Datas que já eram férias são preservadas.
`estado_chamada` devolve os detalhes e fechamentos conforme RLS, somente para
admin/supervisor. Registros antigos incompletos precisam ser complementados
antes de finalizar uma chamada aberta.

Aplicar 007 depois de 001 e 005, sem reaplicar migrações antigas por cima.
**Não aplicado no banco publicado nesta sessão**: não há conexão administrativa
disponível. Sem `estado_chamada` versão 1, a tela preserva a consulta e bloqueia
as gravações para não contornar as regras ou descartar detalhes estruturados.
Os testes de banco usam PostgreSQL local (PGlite), sem escrita no Supabase real.

### Visão geral da coordenação

O coordenador acompanha os supervisores que ainda não finalizaram a chamada e
pode cobrá-los. Não recebe ações de lançar ou finalizar presenças. Os status
dos colaboradores são agrupados por supervisor, sempre dentro da hierarquia
autorizada, com filtro de status e atalho Somente faltas. Esse filtro não altera
a lista de chamadas pendentes nem os totais de fechamento.

A simulação de visão de coordenador pelo admin usa esse mesmo painel. A visão
normal de supervisor continua com suas ações de chamada. Uma chamada pendente
não classifica automaticamente os colaboradores como faltantes.

### Calendário individual

A aba `/calendario` permite escolher um colaborador autorizado e consultar um
mês completo. Usa as mesmas fontes e regras de acesso de presenças, com filtro
de colaborador aplicado na consulta e validação adicional da equipe. Não requer
uma migração nova. No celular, a aba fica no menu Mais.

Cada dia mostra o status e distingue lançamento manual, padrão da chamada e
ocorrência futura prevista. Dia sem dados não é contado como falta. O detalhe
mostra se a chamada foi finalizada; presença padrão não é confirmação manual.
O calendário reflete o contrato de histórico da chamada existente, inclusive
suas limitações para colaboradores inativos e mudanças de cadastro/equipe.

A seleção entre visão geral, de coordenador e de supervisor é exclusiva do
admin. Os demais perfis consultam a própria visão, com os dados autorizados
pela sua hierarquia, sem esse seletor.

### Edição por hierarquia e cobrança

Smart e modalidade aparecem em colunas independentes no cadastro, na visão geral,
nos relatórios e no CSV detalhado. Supervisor pode editar nome, Smart e modalidade
dos colaboradores vinculados à sua equipe; a função `editar_colaborador` valida
o vínculo no banco. As opções de modalidade são híbrido, presencial e home office.
Registros anteriores podem continuar como não informados até sua atualização.

Coordenador edita nome, código e e-mail de contato dos próprios supervisores pela
função `editar_supervisor`. Não pode transferir vínculos, alterar contas ou papéis.
Admin mantém a edição geral e a administração dos vínculos. O e-mail de contato
do supervisor não altera o e-mail de login da conta.

Essas funções estão na migração **006**, que deve ser aplicada após a **005**.
Não foram aplicadas no Supabase publicado nesta sessão: não há conexão
administrativa disponível. A autorização foi concedida pelo usuário; falta o
acesso técnico. A leitura compatível com a estrutura anterior foi preservada.

Relatórios têm atalhos Hoje, Mês atual (dia 1 até hoje) e Mês passado completo.
O botão de cobrança é exclusivo para admin e coordenação; supervisor e RH não
veem essa opção. A ação revalida o perfil ativo antes de gerar o arquivo.
O botão baixa um CSV agrupado por supervisor e data, somente com
chamadas não finalizadas. Considera período e hierarquia selecionados e ignora
busca/status individuais para não omitir equipes. O CSV detalhado continua
respeitando todos os filtros da tabela.

### Compatibilidade com instalações anteriores

A consulta de colaboradores usa `vw_funcionarios_completo` quando a nova view
ainda não existe. Relatórios e visão geral reutilizam `get_chamada_por_data`
e `fechamentos_chamada` quando a função de relatórios ainda não existe.
O vínculo do supervisor é consultado pelo `profile_id` autenticado e aplicado
às consultas. Falhas de autorização não permitem consultas alternativas.
Coordenação sem a coluna de vínculo configurada permanece sem acesso.
Os campos Smart/modalidade ficam ocultos no cadastro antigo e não são enviados
em gravações até que a estrutura correspondente esteja disponível.
Os testes de compatibilidade simulam recursos ausentes e respostas de outra
equipe; não representam validação autenticada no banco publicado.

- `funcionarios.nome_smart`: texto opcional, até 200 caracteres.
- `funcionarios.modalidade_trabalho`: `home_office`, `presencial`, `hibrido` ou
  `nao_informado`. Registros existentes ficam como não informados, sem inventar modalidade.
- `profiles.role`: novo valor `coordenador`, além de admin, supervisor e RH.
- `supervisores.coordenador_profile_id`: um coordenador por supervisor. Novos
  vínculos exigem coordenador ativo. Nenhum vínculo real é atribuído automaticamente.

O admin cria perfis de coordenação em **Usuários** e define cada responsabilidade
na nova aba **Coordenação**. A troca de vínculo remove o acesso da coordenação
anterior imediatamente nas consultas seguintes. Uma sessão já aberta pode manter
na memória dados que tinham sido autorizados antes da troca; ao atualizar, a RLS
passa a aplicar o novo vínculo.

| Perfil | Leitura de colaboradores, presenças e exportações | Operações |
| --- | --- | --- |
| Admin | Todos | Gerenciar usuários/vínculos, editar colaboradores e chamadas; filtrar a visão por coordenador/supervisor |
| Coordenador | Supervisores vinculados e suas equipes | Acompanhar status e fechamento; cobrar seus supervisores |
| Supervisor | Sua própria equipe | Registrar/finalizar chamada e ler cobranças |
| RH | Todos, conforme acesso anterior | Gerenciar colaboradores e exportar; não editar chamadas |

Filtrar a visão do admin não altera sua identidade ou suas permissões.
Supervisores e coordenadores não recebem uma lista global para filtrar no navegador:
a restrição deve ser aplicada no PostgreSQL por RLS, inclusive em RPC e views.

## Cobranças

O botão **Cobrar** registra uma notificação interna em `cobrancas_chamada`.
A notificação aparece na visão geral do supervisor, consultada ao abrir e a cada
60 segundos. O destinatário pode marcá-la como lida.

Não são enviados e-mails ou mensagens externas. O envio acontece após o clique
do usuário. A função verifica papel ativo e vínculo no banco; o navegador não
informa remetente nem mensagem. Há uma cobrança por remetente/supervisor/data,
com repetição idempotente. Chamadas finalizadas e datas futuras não são cobradas;
a cobrança aceita até 93 dias anteriores. Leitura e confirmação também seguem RLS.

## Relatórios

Disponíveis para todos os perfis ativos, dentro do seu escopo. O período máximo é
31 dias; filtros de status, responsável e busca também se aplicam ao CSV.
O CSV é UTF-8 com BOM e separador `;`, com aspas escapadas e proteção contra
fórmulas introduzidas nos campos de texto. A exportação contém todos os registros
filtrados, além da página visível, até o limite explícito de 50 mil registros.
Acima disso, é necessário reduzir o período. Não há truncamento silencioso.

**Pendente** significa que a chamada da equipe ainda não foi finalizada e sua
data não está no futuro. Não significa falta e não significa ausência de um
registro manual. Férias, atestado, afastamento e demais status vêm da função de
chamada existente. Ela não é substituída pela nova migração.
Nome Smart e modalidade são os dados atuais do cadastro; não são snapshots
históricos. O status e o fechamento seguem a data consultada.

## Aplicação e verificação do banco

1. Inspecionar as tabelas e a definição real de `get_chamada_por_data(date)`,
   suas dependências, tipos de `profiles.role`, grants e policies atuais.
   O arquivo `004_inspect_security_readonly.sql` ajuda nessa inspeção.
2. Validar `005_coordenacao_relatorios.sql` contra esse formato real e aplicar
   em transação. Requer os helpers e `audit_logs` do 001, mas não requer aplicar
   o 003. Não executar o 001 novamente depois do 005: ele recria policies antigas.
3. A migração aceita `profiles.role` text/varchar; enum ou checks compostos
   geram um erro e rollback, para adaptação após inspecionar a definição real.
4. Revisar o allowlist de funções. RPCs desconhecidas deixam de ser executáveis
   por usuários comuns. Dependências legítimas da função de chamada precisam ser
   examinadas antes da aplicação, para não interromper o fluxo existente.
5. Confirmar as políticas com tokens de teste de admin, dois coordenadores,
   supervisores de equipes diferentes e usuário inativo. Testar acesso direto
   às tabelas/RPCs com IDs de outra equipe e exportação com filtros adulterados.
6. Criar/atribuir os perfis de coordenação reais conforme o organograma informado.

O teste `tests/coordination.integration.test.mjs` aplica o 001, o 005 e o 006 em
PostgreSQL local, repete a migração e verifica isolamento, troca de IDs, rejeição
de alterações proibidas, status, relatórios, cobranças, confirmação de leitura e
remoção de acesso após trocar o coordenador. Não certifica o ambiente publicado.

Referências: [RLS e views](https://supabase.com/docs/guides/database/postgres/row-level-security),
[funções e privilégios](https://supabase.com/docs/guides/database/functions),
[paginação ordenada](https://supabase.com/docs/reference/javascript/using-modifiers-range).
