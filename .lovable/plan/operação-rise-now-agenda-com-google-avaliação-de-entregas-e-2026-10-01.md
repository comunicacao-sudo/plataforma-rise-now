# Operação RISE NOW: Agenda com Google, Avaliação de Entregas e Turmas

## 1. Agenda e Google Agenda / Meet
- No painel de administração, botão **"Conectar Google Agenda"**: cada administradora ou mentora conecta a própria conta Google uma vez.
- Nova tela **"Agendar encontro"** com: título, pilar/mês, mentora responsável, data, horário de início e de fim e um vínculo opcional com uma sessão da trilha.
- **Para quem é o encontro:** todas as turmas, uma turma específica ou mentoradas escolhidas (1:1 ou um grupo pequeno).
- Opção **"Gerar reunião no Google Meet"**: cria o evento na agenda de quem está conectada, já com o link do Meet, e envia o convite para as participantes.
- Aba **Agenda da mentorada**:
  - Mostra os **Próximos encontros** em ordem de data, e cada card traz data, hora, pilar, mentora e se é coletivo ou 1:1.
  - O botão **"Entrar no Google Meet"** ganha destaque perto do horário.
  - Uma seção separada mostra os **Encontros realizados**, com a gravação quando houver.
  - A tela inicial também passa a mostrar o próximo encontro.
- As administradoras podem editar ou cancelar um encontro, e a mudança também vale no Google.

## 2. Painel de Avaliação de Entregas
- Lista de todas as entregas, com filtros por turma, mentorada e mês, e o status de cada uma nos 5 estados.
- **Tela de revisão:**
  - Mostra o texto enviado, o link e o arquivo para baixar, além da data e hora do envio.
  - O **Feedback para a aluna** aparece na tela de entrega dela.
  - As **Anotações confidenciais** nunca aparecem para a aluna.
  - Botões **"Solicitar ajustes"** (volta para "Em andamento") e **"Aprovar entrega"** (vira "Concluída"). Quando a mentora abre uma entrega enviada, ela passa sozinha para "Em revisão".
- A mentora vê só as mentoradas dela. As administradoras veem todas.

## 3. Gestão de Alunas e Turmas
- **Turmas:** criar e editar uma turma com nome, data de início e data de conclusão.
- **Cadastrar aluna:**
  - Campos: nome, e-mail, turma, mentora responsável e senha inicial.
  - O cadastro já cria o acesso com troca de senha obrigatória e faz a matrícula na trilha.
  - Também dá para cadastrar mentoras.
- **Visão da turma:**
  - Tabela com nome, turma, mentora, avanço na trilha e status da entrega do mês.
  - Ações para **pausar**, **reativar**, **desativar** e **redefinir senha**.
  - A comunicacao@pamarisdigital.com entra na "Turma 1".
- **E-mail de boas-vindas:** o envio automático precisa de um domínio de e-mail configurado. Até lá, a senha inicial aparece na tela para vocês repassarem.

## O que vocês precisam fazer
- **Google:** criar uma vez um acesso Google da empresa (OAuth). Eu mostro o passo a passo na hora. Depois disso, cada mentora só clica em "Conectar".

## Detalhes técnicos
- Novas tabelas: `cohorts`, `cohort_members`; `meetings` ganha `audience` (all/cohort/selected), `cohort_id`, `mentor_id`, `phase_id`, `lesson_id`, `ends_at`, `google_event_id`, `recording_url`, `created_by`; `meeting_attendees` para seleção individual; `submissions` ganha `feedback`, `submitted_at`, `reviewed_by`; notas confidenciais usam `notes` com `mentor_private`; `enrollments`/perfis ganham status (ativa/pausada/desativada).
- RLS: mentorada lê encontros onde audience=all, sua turma ou ela é participante; mentor_private nunca legível pela mentorada; GRANTs em todas as tabelas novas.
- Google: App User Connector `google_calendar` (cada admin/mentora conecta a sua conta), chave de conexão criptografada em `app_user_connections`; eventos criados com `conferenceData` (Meet) via server functions autenticadas.
- Cadastro/ações de acesso via server functions com verificação de admin no servidor e admin API; auditoria em `audit_log`.
- Não refazer: conta gmail removida continua excluída.

## Próximo passo depois deste
Painel para colar gravações e materiais de apoio em cada aula, e e-mails automáticos (boas-vindas, aviso de encontro, feedback) com domínio próprio.
