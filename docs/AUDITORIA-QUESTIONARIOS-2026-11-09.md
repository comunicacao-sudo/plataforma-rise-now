# Editor e múltiplos questionários — 09/11/2026

## Resultado

O cadastro e a edição de questionários da mentora passam a usar o layout aprovado: editor amplo, perguntas verticais e recolhíveis, campos que crescem com o texto, informações gerais separadas e rodapé sempre visível com prévia e salvamento. No celular o editor ocupa a tela, com uma única área de rolagem vertical.

Também foi removido o bloqueio que permitia somente um questionário por público e etapa. Cada novo questionário recebe sua própria identidade. Editar um existente mantém suas identidades e não substitui os demais. A tabela de respostas já separava os envios por questionário e matrícula; não foi necessária migração de banco.

## Funções e proteção dos dados

- Título, descrição e público são preservados. O público pode ser geral, uma turma ou um mentorado.
- Perguntas podem ser recolhidas, duplicadas, reordenadas e removidas no formulário. Duplicar cria outra identidade e copia as opções sem compartilhar a lista de edição.
- Respostas longas, curtas e de escolha única continuam usando os tipos já aceitos pelo servidor. A obrigatoriedade é configurável por pergunta.
- A prévia é local: experimentar respostas não envia o questionário nem altera as perguntas.
- Textos e opções são validados antes de salvar. Os limites exibidos correspondem aos limites existentes do servidor: 50 perguntas, 1.000 caracteres por pergunta, 20 opções e 300 caracteres por opção.
- Falha no salvamento mantém o formulário preenchido para nova tentativa. Os botões de fechar e salvar ficam protegidos enquanto o envio está em andamento.
- A autorização da mentora permanece no servidor. A liberação de vários cadastros não altera as regras de público, matrícula ou data de disponibilização.
- O mentorado vê os questionários permitidos dentro da própria etapa, com títulos para distinguir os formulários. As respostas de um não sobrescrevem as do outro.
- O envio de um questionário não conclui o conjunto quando há outro pendente na mesma etapa. Ao concluir os envios, o avanço é atualizado sem apagar o tempo de vídeo já registrado.

## Análise por IA

Os questionários cadastrados dentro das aulas e módulos **não são analisados por IA**. Eles continuam em `journey_stage_questionnaire_responses`, enquanto o perfil comportamental usa `assessment_attempts` e seu fluxo próprio de análise.

Foi conferido que as tabelas dos questionários de aula não possuem gatilhos de análise por IA. O envio comum não chama a fila de interpretação do perfil. O título de uma aula contendo “perfil comportamental” também não redireciona um questionário cadastrado para essa experiência.

O perfil comportamental oficial conserva sua análise. Questionários complementares anexados à etapa oficial continuam sendo formulários comuns e não substituem sua conclusão ou seu envio para interpretação.

## Validação

- **149 testes automatizados aprovados**; TypeScript e ESLint sem erros. Os 12 avisos de organização de componentes já existentes continuam registrados.
- Edge Function `rise-backend` verificada pelo Deno e publicada no projeto de produção `riakceytqrlvdcgcwfdx`.
- Teste transacional `supabase/tests/multiple-questionnaires.sql`: dois cadastros no mesmo público/etapa em cada um dos escopos geral, turma e pessoa, com respostas independentes. Todas as fixtures foram revertidas.
- **12 cenas visuais** do editor: informações, perguntas e prévia, em desktop 1366 × 768 e celular 390 × 844, nos temas claro e escuro. Sem problemas detectados de contraste, nomes acessíveis dos controles, referências ARIA ou largura. Cabeçalho, rodapé e botões permaneceram dentro da tela.
- Os testes de interface também exerceram validação de campos, duplicação, ordenação, opções com espaços, erro seguido de reenvio, criação de vários registros e edição preservando as identidades.
- **Dois fluxos de mentorado** verificaram a abertura e o envio de dois questionários na mesma etapa. As respostas ficaram separadas, inclusive usando a mesma chave interna de pergunta nos dois formulários. Não houve acionamento da geração de análise por IA.
- Os testes de interface usaram dados simulados e bloquearam serviços externos. Nenhuma análise por IA, mensagem ou convite real foi disparado para teste.

## Carregamento e publicação

O editor faz parte da área de conteúdos carregada sob demanda. Os formulários adicionais são enviados no detalhe da etapa, sem multiplicar os textos da biblioteca inicial. Não foi adicionada chamada de IA nem consulta individual por pergunta.

O build ficou em **344.672 bytes gzip** de JS/CSS; entrada pública **106.990 bytes** e entrada autenticada **53.884 bytes**, dentro dos limites do projeto. Esses valores são limites de tamanho, não uma medição da conexão dos participantes.

A publicação da interface é conferida no domínio da RISE comparando os arquivos de JavaScript e CSS com o build validado, após a sincronização da main com o Lovable.
