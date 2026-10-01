# Trilha oficial de 6 meses RISE NOW

## O que a mentorada vai ver
- **Tela inicial** com a jornada real de 6 meses (Reflexão, Identidade, Segurança e IA, Evolução), mostrando a etapa atual, o próximo encontro e o progresso.
- **Os 4 pilares e as mentoras**: Camila Um (Reflexão, mês 1), Gabriela Ribeiro (Identidade, semana 1 do mês 2), Luiza Mendes (Segurança e IA, semanas 2 a 4 do mês 2), Camila Mariano (Evolução, meses 3 a 6).
- **Todos os encontros, sessões 1:1 e aulas** listados no documento, mês a mês, em fileiras no estilo streaming.
- **Tela da aula ou do encontro**:
  - Vídeo da gravação (Meet, YouTube ou Vimeo) quando houver um.
  - Para encontros ao vivo: sala de espera com data, horário e o botão "Entrar no Google Meet".
  - Resumo com objetivos e temas centrais.
  - "Materiais de Apoio": uma área elegante, com a mensagem "em breve" enquanto não houver arquivos.
  - "Caderno de Anotações": salva sozinho e só a mentorada vê.
  - A aula é concluída sozinha quando o vídeo termina. O encontro é concluído sozinho depois que acontece. Não existe botão "concluir".
- **Área de Entregas**: as 6 entregas, uma por mês. A mentorada pode enviar um texto, um arquivo ou um link. Cada entrega mostra um destes status: Não iniciada, Em andamento, Enviada, Em revisão ou Concluída.
- **Matrícula**: a conta comunicacao@pamarisdigital.com é inscrita na jornada e passa a ver o próprio trilho.

## O que fica para depois
- Painel das administradoras para colar links de vídeo, links do Meet e datas. Até lá, esses dados são cadastrados por aqui no chat.
- Vídeos e materiais reais: as telas ficam prontas e vazias, à espera dos arquivos.

## Detalhes técnicos
- Cadastro do programa, das 6 fases, das aulas e encontros (tabela `lessons` com kind `aula`/`encontro`) e das 6 entregas, feito pelas ferramentas de dados.
- Migração aditiva: adicionar `lessons.mentor_name`, `lessons.join_url`, `lessons.scheduled_at` e `submissions.link_url`/`file_path`. Criar um bucket privado `deliverables` com acesso por enrollment e links temporários.
- Inscrição (`enrollments`) da mentorada com current_month = 1.
- O frontend lê do banco (react-query), não de `src/data/rise-content.ts`. A demonstração continua usando os dados fictícios.
- Caderno: `notes` com visibilidade mentee_private, salvamento automático 1 s depois de parar de digitar, uma nota por aula.
- Conclusão automática: evento `ended` / postMessage do player (YouTube e Vimeo); para Meet/Drive, conclusão a 90% do tempo assistido; para encontros, após `scheduled_at + duration`. Grava em `lesson_progress` e recalcula `progress_pct`.
- Nova tela da aula como rota `/aula/$id` com head() próprio.
