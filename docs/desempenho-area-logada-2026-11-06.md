# Desempenho da página logada — 06/11/2026

A nova investigação trata da página inicial da mentorada após o login. A medição de abertura publicada na revisão anterior tratava principalmente da entrada no site; não demonstra o tempo necessário para baixar as capas privadas da jornada.

## Problemas encontrados

- Há capas PNG próximas de 1,8 MB cada no Storage privado. Essa carga continua relevante mesmo depois de reduzir o JavaScript.
- Os cartões incluíam dois elementos de imagem, para os temas claro e escuro, escondendo um por CSS.
- A biblioteca recebe novas URLs assinadas a cada atualização. Mesmo quando a arte não muda, trocar o endereço pode provocar outra transferência da imagem.
- Vários componentes observavam a mesma biblioteca com temporizadores de atualização próprios. O temporizador passou a ter um responsável único, mantendo os outros componentes como consumidores do mesmo cache.
- A consulta do próximo passo só começava depois de carregar a trilha. Ela agora começa em paralelo, com chave de cache por usuário.
- O símbolo de interrogação era o ícone `FileQuestion` do questionário, não falha de carregamento. Foi substituído por `ClipboardList`, mantendo a identificação textual e as regras de disponibilidade.

## Correções de código

Um único elemento de imagem escolhe a capa do tema ativo e reage à troca de tema. As imagens fora da primeira área visível usam carregamento sob demanda. URLs de capas ainda válidas são reutilizadas somente quando correspondem ao mesmo arquivo e à mesma matrícula. Progresso, lista de conteúdos e permissões continuam vindo da resposta nova; conteúdos removidos não são preservados pelo cache.

Novos uploads de capas PNG, JPEG ou WebP são reduzidos no navegador para até 1280 pixels no maior lado e codificados em WebP quando isso economiza espaço. O original escolhido pela pessoa não é alterado. Arquivos pequenos ou formatos não contemplados são preservados. O upload mantém caminho novo e cache de longa duração.

## Validação

- 89 testes automatizados passaram, incluindo validade dos endereços, alteração de capa, expiração, mudança de matrícula e remoção de conteúdo.
- Tipos e lint passaram; build passou dentro dos limites de tamanho existentes.
- No teste da página logada com dados, URLs e imagens artificiais, as solicitações de capas caíram de 28 para 12, com as seis fases da jornada simuladas. Elementos de capa no conjunto de cartões: 16 para 8. A versão corrigida não solicitou a capa do outro tema na visita inicial; a troca de tema carregou a variante correspondente. Nenhuma conta real foi usada nem respostas pessoais foram acessadas nesse teste.
- O teste de upload com uma imagem artificial de 2560 × 1440 produziu WebP de 1280 × 720, com menos bytes que o original.

Essas contagens validam o comportamento dos componentes e não são uma medição do tempo de acesso de uma mentorada real. A diferença de tempo entre o endereço público e o servidor local não foi usada como estimativa de ganho.

## Capas já cadastradas

A usuária autorizou explicitamente baixar e compactar as capas privadas. Foram processados 54 PNGs de 1672 × 941 para WebP de 1280 × 720, qualidade 88. O conjunto passou de 77.158.581 para 4.179.184 bytes somando as versões correspondentes a cada original: redução de 94,58%. A maior capa resultante tem 137.112 bytes. A inspeção visual comparou original e versão menor de uma amostra.

Arquivos idênticos compartilham a mesma versão otimizada: 35 novos objetos, 2.057.062 bytes efetivamente enviados. Os 54 originais permanecem intactos no mesmo bucket privado. A migração atualizou referências exatas de 76 registros de etapas, incluindo versões anteriores, e a consulta de conferência encontrou zero referências sem arquivo correspondente. Nenhuma imagem privada foi incluída nos arquivos públicos ou no Git. O manifesto `capas-otimizadas-2026-11-06.json` registra caminhos, dimensões e tamanhos para rastreabilidade e reversão.

## Primeiro bloco da página inicial

No desktop, o bloco usa a altura útil da janela. O título, os espaçamentos, os metadados e o botão foram ajustados para aparecerem juntos. O cabeçalho sobreposto continua com sua área reservada. Conteúdo excepcionalmente longo e ampliação de texto podem expandir a seção; não há corte de conteúdo nem rolagem forçada.

A conferência com texto longo, descrição, três metadados e botão passou nos temas claro e escuro em 1366 × 633, 1280 × 620, 1440 × 800, 1920 × 950, 1024 × 650 e 1024 × 500. A altura de 633 pixels representa a área do site em uma tela de notebook com navegador e barra do sistema. Celular e tablet (390 e 820 pixels de largura) mantêm o fluxo vertical e passaram sem rolagem horizontal. Essas verificações usam dados simulados.
