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
| Testes automatizados | 118 aprovados após a conferência de 07/11 |
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

A chave `GOOGLE_DRIVE_API_KEY` foi cadastrada no Supabase pela administradora e sua presença foi confirmada sem exibir seu valor. A conferência real com login de mentora foi realizada em 07/11, conforme o resultado abaixo; ela substitui a pendência inicial de acesso ao navegador.

### Conferência com login de mentora — 07/11/2026

- A versão publicada foi carregada com a conta de mentora.
- Uma gravação privada no R2 reproduziu por mais de um minuto, sem erro do player. A duração real de 7.890,125 segundos foi identificada e registrada automaticamente.
- O player usou controles nativos, `nodownload` e nenhuma prévia em iframe do Drive.
- Antes e depois da prévia, `journey_video_progress` permaneceu sem registros e `journey_content_progress` manteve os mesmos cinco registros, 263 segundos agregados e a mesma última atualização. A prévia não alterou o avanço dos mentorados.
- O serviço de mídia recebeu HTTP 403 ao buscar uma gravação do Drive. A validação de metadados também recebeu uma recusa do provedor. O acesso da mentora à RISE e a validação de sua sessão no banco estavam corretos.
- O tratamento de erros agora diferencia chave inválida, API desativada, restrições de API/aplicativo, quota e recusa de acesso ao arquivo. Só códigos e mensagens seguros são devolvidos; a chave e a resposta original do Google não são expostas.
- A consulta autenticada aos metadados confirmou a existência do arquivo, mas não retornou uma lista de permissões que permitisse verificar autorização de reprodução para a integração. Nenhum compartilhamento foi alterado e nenhuma gravação do Drive foi baixada ou transferida durante essa conferência.
- A administradora confirmou que gravações com mais de dez minutos devem permanecer no Drive. A proposta de copiar essas gravações para o R2 não será executada.

Após o ajuste dos diagnósticos, os 118 testes automatizados passaram.

### Conexão privada do Drive — 07/11/2026

- Implementada conexão OAuth separada do Google Agenda, usando o mesmo cliente Google já configurado na RISE e credenciais criptografadas no servidor.
- O consentimento solicitado é `drive.readonly`: o Google permite ler/baixar todos os arquivos acessíveis à conta. Essa abrangência aparece na configuração antes de conectar. No aplicativo, o token é usado apenas para vídeos cadastrados ou explicitamente autorizados pela dona da conexão.
- Painel recolhível em Conteúdos, exclusivo das mentoras, com conexão, autorização de cada gravação e desconexão. A consulta ao Google é adiada até a abertura do painel.
- A autorização pertence ao conteúdo e à sua revisão exata. Trocar o link invalida o vínculo; trocar a conta Google remove as autorizações da conta anterior. Uma mentora sem acesso ao arquivo não pode vinculá-lo usando o token de outra.
- A transmissão ainda exige ticket assinado, sessão ativa e acesso à aula; os destinatários de cada vídeo 1:1 não foram alterados. Nenhum token ou chave Google é devolvido ao player.
- A conexão não altera compartilhamentos, não exclui arquivos e não transfere gravações para outro armazenamento. A desconexão do Drive remove a ligação local sem revogar a Agenda por engano.
- Verificados 122 testes automatizados; verificação de tipos; lint sem erros, com 12 avisos preexistentes; Deno; compilação e limites de tamanho dos arquivos.
- Oito verificações de interface com serviços simulados cobriram celular/desktop, temas claro/escuro, retorno OAuth, autorização e desconexão: sem falha de contraste, rolagem horizontal ou erro de página.
- Testes no banco real com rollback confirmaram isolamento entre vídeos/revisões, rejeição de credencial de mentorado e bloqueio de leitura/execução pelos papéis públicos.
- **Pendente de ação da administradora:** concluir o novo consentimento Google em Conteúdos e autorizar as três gravações. A reprodução real pelo Drive só pode ser considerada aprovada depois desse consentimento e de um novo teste do vídeo.

Referências: [escopos de autorização do Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) e [leitura de arquivos e permissão canDownload](https://developers.google.com/workspace/drive/api/guides/manage-downloads).

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
