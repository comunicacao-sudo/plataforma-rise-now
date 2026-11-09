# Correção do envio de aulas — 09/11/2026

## Ocorrência e evidência

A usuária relatou “Failed to fetch” logo ao selecionar o vídeo no aplicativo instalado e confirmou que o envio funcionou pelo Chrome no domínio principal.

A verificação mostrou que o Worker de upload aceitava somente https://board.mentoriarisenow.com.br. O endereço oficial publicado no Lovable, https://plataforma-rise-now.lovable.app, recebia OPTIONS sem Access-Control-Allow-Origin, o que impede o navegador de iniciar o envio. Essa falha foi reproduzida. A origem exata da instalação da usuária não foi confirmada; portanto, ela é uma explicação possível para a diferença entre os acessos, não uma causa atribuída com certeza à instalação específica.

Também foi confirmado no código efetivamente publicado que as rotas retornavam Promises de handlers assíncronos sem await dentro do try/catch. Uma falha posterior de autenticação, RPC ou R2 escapava desse catch, podendo gerar resposta sem CORS e esconder a causa no navegador.

## Correção

- Lista explícita dos dois endereços oficiais, sem curingas ou liberação de previews e sites externos. A resposta CORS reflete somente a origem oficial da requisição.
- Origens externas recebem 403, inclusive no preflight.
- Login e papel de equipe continuam obrigatórios. Nenhuma permissão de usuário, política RLS ou chave foi alterada.
- As rotas aguardam os handlers assíncronos. Exceções retornam JSON com CORS e mensagem em português.
- O registro de erro do código contém apenas tipo do evento, caminho sem query e mensagem da exceção; não registra Authorization nem o corpo enviado.
- O cliente traduz falhas de conexão conforme a fase: iniciar, enviar uma parte ou concluir. Informa também quando não há internet. O formulário preenchido é preservado.
- Nenhuma repetição automática de /upload/start foi introduzida, evitando abrir uploads duplicados quando a resposta de uma tentativa se perde.

## Publicação do Worker

A atualização usa a API de substituição somente do conteúdo do Worker. Foi comparada a configuração antes e depois: bindings do bucket privado, origem, Supabase e segredo dos tickets foram preservados integralmente, assim como a data de compatibilidade 2026-10-22. O módulo da lixeira e sua limpeza após 30 dias continuam no bundle.

A tentativa de ativar novos logs e traces persistentes foi rejeitada pela revisão automática por exigir autorização específica para coleta de dados operacionais. Não foi repetida por outra via. A validação foi feita por testes isolados e chamadas HTTP sem essa alteração de observabilidade.

## Validação

- 166 testes automatizados aprovados.
- TypeScript e ESLint sem erros; permanecem os 12 avisos existentes de Fast Refresh.
- Testes do Worker com serviços simulados: preflight dos dois endereços, bloqueio de outras origens, exigência de login e papel de equipe, início de multipart, partes, conclusão e exceções de autenticação, RPC e R2.
- Quatro cenários da interface: desktop 1366 × 768 e celular 390 × 844, nos temas claro e escuro. Uma falha de rede foi simulada; a mensagem apareceu em português e preservou o título. Uma nova tentativa concluiu upload e salvou o caminho privado do vídeo.
- Em produção: OPTIONS 204 com origem correta nos dois endereços oficiais; POST sem login 401 em ambos; origem externa 403 sem permissão CORS. Nenhum vídeo real foi enviado pelo agente.
- O envio real autenticado pelo domínio principal foi confirmado pela própria usuária.
- JS/CSS: 347.944 bytes gzip; entrada pública 107.068; entrada autenticada 54.130, dentro dos limites existentes.

## Limite da verificação

O aplicativo instalado da usuária não foi controlado para um novo envio autenticado: a ferramenta de computador encerrou a inspeção por não conseguir verificar sua URL. Após atualizar ou reabrir a RISE, ainda cabe confirmar o envio nessa instalação específica. Não é necessário alterar chaves para usar a correção.
