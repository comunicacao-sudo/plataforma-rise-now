# Aviso de atualização da RISE — 09/11/2026

## Resultado

Foi conferido o aviso do VLC em Pamarisltda/clubeempresariocaro, no componente src/components/pwa/app-update.tsx: “Nova versão disponível”, com “Atualizar agora” e “Mais tarde”. A RISE passa a oferecer o mesmo fluxo, adaptado à sua identidade visual, no navegador e no aplicativo instalado.

O aviso é discreto, não toma o foco, cabe no celular e no computador e respeita os temas claro e escuro. Nenhuma atualização recarrega a tela automaticamente.

## Detecção e carregamento

- Cada build produz um identificador SHA-256 dos arquivos da aplicação e publica somente esse identificador em /app-version.json. O mesmo valor é incorporado ao JavaScript.
- O identificador é estável entre Windows e Linux: caminhos são relativos e as quebras de linha de arquivos de texto são normalizadas. Arquivos de ambiente e rotas geradas não participam.
- A consulta começa depois da abertura da tela, sem cookies nem credenciais. Repete a cada cinco minutos enquanto a página está visível e online; voltar ao aplicativo ou recuperar a conexão também permite conferir, com intervalo mínimo de 30 segundos entre consultas bem-sucedidas.
- O JSON público usa Cache-Control: no-store, não é guardado pelo service worker e não contém dados de participantes.
- Respostas inválidas, erro de publicação ou falha de conexão não geram aviso falso e permitem nova tentativa. A consulta tem cancelamento e limite de 15 segundos.
- “Mais tarde” adia o mesmo aviso por 30 minutos. Uma versão diferente pode ser informada antes disso.
- O componente é carregado sob demanda. O service worker mantém sua política anterior: HTML, respostas, sessões, APIs, vídeos e capas privadas seguem pela rede.

## Proteção do trabalho em andamento

A recarga só ocorre por clique explícito, com internet e após a verificação das proteções, no mesmo trecho síncrono.

- Chamadas ao backend registram bloqueio enquanto estão em andamento e o liberam em finally, inclusive quando falham.
- Formulários e editores visíveis devem estar salvos e fechados. Esta é uma proteção conservadora: não há tentativa de adivinhar se um formulário aberto pode ser descartado.
- A reprodução de vídeo ou áudio impede a recarga até ser pausada.
- As anotações da aula registram seu último texto efetivamente salvo. Texto novo, salvamento pendente ou edição de marcador impedem a atualização.
- Sem internet, aparece uma orientação de conexão, sem botão de recarga.
- Não são apagados cookies, armazenamento local, login ou respostas para atualizar.

## Validação

- 157 testes automatizados aprovados, incluindo identidade reproduzível do build, mudança de versão, ausência de aviso na versão atual, rollback, limitação de consultas, falta de rede, resposta inválida, cancelamento e bloqueio de atualização.
- TypeScript e ESLint sem erros. Permanecem os 12 avisos existentes de Fast Refresh.
- Cinco cenários de interface com serviços externos bloqueados: desktop 1366 × 768 e celular 390 × 844 nos dois temas, mais recuperação após falha de publicação.
- Conferidos contraste, nomes dos botões, atributos ARIA, limites da tela, adiamento, nova versão após adiamento, ausência de cookies na consulta, ausência de recarga automática, proteção de formulário e vídeo em reprodução, aviso offline e uma única recarga após o clique autorizado.
- Nenhum participante, mensagem, convite ou análise por IA foi usado no teste.
- Build: JS/CSS total 347.875 bytes gzip; entrada pública 107.075; entrada autenticada 54.056, dentro dos limites existentes.

## Publicação e primeiro uso

O recurso depende apenas da publicação do frontend no Lovable; não requer nova chave nem alteração de banco ou Edge Function.

Uma janela que ainda executa a versão antiga não possui o novo detector. É necessário salvar o trabalho e atualizar essa janela uma vez. A partir da versão que contém este recurso, as próximas publicações passam a ser identificadas pelo aviso.
