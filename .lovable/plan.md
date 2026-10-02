# RISE NOW: Agenda pessoal, RISE 90, Materiais e Avisos

## 1. Botão "Adicionar à minha Agenda" (mentorada)
- Aparece no aviso de próximo encontro da tela inicial, nos cards da Agenda e na tela do encontro.
- **"Adicionar ao Google Agenda"**: abre o Google Agenda dela já preenchido com título, mentora, horário, temas e link do Meet. Ela não precisa autorizar nada.
- **"Baixar convite"**: gera um arquivo que funciona no iPhone, no Mac e no Outlook.
- O botão "Entrar no Google Meet" pulsa em dourado de 15 minutos antes até o fim do encontro.

## 2. RISE 90 interativo
- No topo, uma régua mostra o "Dia X de 90", quantos dias faltam e o progresso geral em dourado e marsala.
- A mentorada cadastra e edita as 3 metas, cada uma com título, descrição, indicador de sucesso e prazo, e ajusta o percentual de 0% a 100%.
- Cada meta tem marcos que ela marca conforme conclui.
- Na tela **Alunas e turmas**, a equipe clica na aluna e vê as metas, os percentuais e os marcos. Ali também registra notas de orientação, com a opção de mostrar a nota à aluna ou deixá-la confidencial.

## 3. Materiais de apoio
- Na Agenda e na trilha do painel da equipe, cada aula ou encontro ganha o botão **"Materiais"**. Ele permite adicionar um link (Drive, Notion, leitura) ou enviar um arquivo (PDF, apresentação), com título e descrição.
- Na tela da aula ou do encontro, a mentorada vê cards com um ícone do tipo, o título e o botão **Abrir** ou **Baixar**. O aviso "em preparação" só aparece enquanto não houver material.
- Os arquivos são privados e só abrem para quem tem acesso, por meio de links temporários.

## 4. Central de avisos
- No topo da tela da mentorada fica um sino com um ponto dourado quando há novidades.
- Avisos gerados sozinhos: novo encontro marcado para ela, entrega aprovada ou com pedido de ajustes e novo material na trilha dela.
- A lista abre com um clique e leva direto à entrega ou ao encontro. Também tem o botão **"Marcar todas como lidas"**.

## Detalhes técnicos
- Google: URL `calendar.google.com/calendar/render?action=TEMPLATE...`. O arquivo .ics é gerado no navegador.
- RISE 90: reaproveitar `rise90_goals` (com campos de descrição, indicador, prazo e percentual), a nova tabela `rise90_milestones` e o início do ciclo na enrollment. As notas da equipe usam `notes` (`shared` ou `mentor_private`).
- Materiais: nova tabela `lesson_materials` (lesson_id ou meeting_id, kind link/file, title, description, url, file_path). Bucket privado `materials` com URLs assinadas. A escrita é só para a equipe.
- Avisos: tabela `notifications` (user_id, type, title, link, read_at), preenchida por gatilhos em meetings/meeting_attendees, submissions (mudança de status) e lesson_materials. Cada usuária só lê e atualiza os próprios avisos.
- RLS e GRANTs em todas as tabelas novas. A mentorada nunca lê `mentor_private`.
