# Auditoria de Jornada, Conteúdos e Agenda — 06/11/2026

## Alterações entregues

- Jornada da mentora organizada em cartões por pilar, com edição, ordenação, prévia, rascunho, publicação e confirmação de conclusões.
- Conteúdos agrupados por pilar e etapa, com busca e filtros de público e turma.
- Várias aulas por etapa e público, com seleção de vídeo, navegação entre aulas e ordenação protegida contra alterações concorrentes.
- Duração identificada no arquivo enviado ao R2 ou pela API Google Drive. A duração manual continua disponível quando o arquivo não fornece metadados legíveis.
- Player próprio para vídeos do Drive, sem iframe de prévia nem atalho para abrir o arquivo original.
- Acompanhamento separado por vídeo e revisão da gravação: início, maior posição alcançada, conclusão e última reprodução. A prévia da mentora não gera progresso de mentorados.
- Gravações substituídas não herdam a posição ou a conclusão do vídeo anterior. Uma segunda aula não herda o progresso agregado da etapa.
- Reprodução preservada durante as atualizações automáticas de dados; progresso sincronizado periodicamente, ao pausar e ao sair da página, quando a conexão permite.
- Minha Jornada do mentorado com etapa atual, avanço e listas por pilar; frases de abertura e de cada mês preservadas.
- Remoção do carrossel “Sua jornada de 6 meses” e do cartão duplicado de onboarding no Início. O próximo encontro real da Agenda permanece.
- Entregas ocultada da navegação de mentorados e mentoras. Registros, respostas e metas anteriores foram preservados.
- Etapas vinculáveis aos encontros e às disponibilidades 1:1. As reservas mantêm o vínculo com a matrícula. Datas de encontros visíveis prevalecem na jornada; datas planejadas aparecem no calendário sem criar convites.
- Reagendamento pela Agenda, incluindo atualização do evento Google quando existir. Turmas e encontros individuais conservam as próprias datas, sem gravar uma data privada na etapa compartilhada.
- Correções de contraste, botões de agendamento antes escondidos no celular, Agenda inicialmente semanal no celular e ajuste do espaço da marca no rodapé.
- Cinco índices de chaves estrangeiras adicionados. Busca de conteúdos usa um resumo por pilar e etapa, sem baixar capas no resumo.

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| Testes automatizados | 117 aprovados |
| TypeScript do aplicativo | Aprovado |
| Identificadores e sintaxe das Edge Functions | Aprovados; verificação incorporada ao pré-teste |
| Deno: backend e serviço de mídia | Aprovado |
| Compilação de produção e limites de desempenho | Aprovados |
| Navegador com dados simulados | 36 telas nos temas claro/escuro, desktop de 1366 px e celular de 390 px |
| Fluxos adicionais no celular | Upload com duração real do arquivo, ordenação, encontro vinculado e reagendamento; mais 3 telas |
| Contraste, largura e erros de página nesses cenários | Nenhuma falha restante |
| Banco real, com transações revertidas | Progresso independente de duas aulas; isolamento da Agenda; resolução do vídeo exato no R2; ordenação e conflito de edição; vínculo de reserva 1:1 |
| Serviços publicados sem autenticação válida | Backend e mídia retornam HTTP 401 |
| Resíduos dos testes no banco | Nenhum conteúdo, encontro ou reprodução fictícia persistiu |

Os testes de navegador interceptaram serviços externos. Não enviaram convites, WhatsApp ou e-mails reais. Os testes de banco usaram `BEGIN`/`ROLLBACK`.

O lint mantém 12 avisos preexistentes de desenvolvimento do React Fast Refresh, sem erros. O verificador de saúde do banco não apontou problemas. As cinco ausências de índices de chaves estrangeiras encontradas na revisão foram corrigidas. Os avisos informativos sobre índices novos ainda sem uso não justificam removê-los. O alerta existente sobre `public.has_role` foi revisado: a função de consulta de permissões é utilizada pelas políticas de acesso e não foi removida.

## Desempenho

Compilação final, com tamanhos comprimidos:

- Entrada pública: 106.965 bytes, dentro do limite de 110.000.
- Entrada autenticada: 50.446 bytes, dentro do limite de 55.000.
- JavaScript e CSS totais: 331.959 bytes, dentro do limite de 900.000.

O salvamento frequente de progresso usa a operação específica do vídeo, sem remontar nem assinar toda a biblioteca. Atualizações não renovam desnecessariamente a URL de um vídeo que está sendo reproduzido. O aplicativo instalado segue as mesmas alterações responsivas. O service worker não armazena vídeos, sessões ou respostas privadas.

## Limites e conferência real

A chave `GOOGLE_DRIVE_API_KEY` foi cadastrada no Supabase pela administradora e sua presença foi confirmada sem exibir seu valor. A reprodução real de um arquivo do Drive e a duração retornada pela configuração dessa conta ainda dependem da conferência com uma sessão de mentora no navegador do app. O teste simulado de metadados não substitui essa conferência.

O player próprio não oferece DRM. Acompanhamento registra eventos de reprodução e a maior posição alcançada; não comprova atenção contínua. A integração não altera as permissões de compartilhamento do arquivo original no Drive. Conteúdos removidos são desativados e seus registros anteriores são preservados.

## Reprodução das verificações locais

```sh
npm test
npm run typecheck
npm run lint
npm run build
node scripts/check-edge-identifiers.mjs
```

No Windows, utilizar o procedimento de caminho curto já adotado pelo projeto para a compilação e os testes. As migrações desta entrega ficam em `supabase/migrations`; os serviços são `rise-backend` e `rise-media`. Nenhuma chave deve ser incluída no repositório.
