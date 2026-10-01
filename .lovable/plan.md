# Aplicar a identidade visual RISE NOW em toda a plataforma

## O que muda para quem usa
- **Logotipo oficial** no lugar do texto atual: versão branca/creme no topo da navegação (fundo escuro), versão marsala/dourada na tela de acesso e de nova senha, e o ícone (estrela + símbolo) como ícone da aba do navegador.
- **Cores oficiais** revisadas em todas as telas: marsala #5A0F14 como base, dourado #D0AC5C para destaques (botões principais, etapa atual, links), rose #99666B para equilíbrio (textos de apoio, etiquetas), sobre preto e creme.
- **Tipografia**: Montserrat (arquivos enviados) em títulos e textos; Cormorant Garamond Italic apenas em frases de destaque (ex.: saudação do início, citações, subtítulos dos pilares).
- **Elementos visuais do manual**: estrela minimalista como marcador (etapa atual, pilar ativo), linhas finas douradas como divisores, mais respiro entre blocos e menos efeitos — sem brilhos excessivos.
- **Assinatura dos pilares**: "Reflexão · Identidade · Segurança · Evolução" no rodapé e na tela de acesso, como no logotipo.

## Telas afetadas
Acesso/login, primeiro acesso (nova senha), redefinir senha, início da mentorada, jornada, painel da mentora e painel administrativo.

## Detalhes técnicos
- Logos enviados para o armazenamento de arquivos (pointers .asset.json); favicon gerado a partir do ícone em `public/favicon.png`, removendo `favicon.ico`.
- Fontes Montserrat já em `/fonts`; confirmar arquivos, adicionar Cormorant Garamond Italic via `<link>` no `__root.tsx` e token `--font-display`.
- Revisar tokens em `src/styles.css` (adicionar `--gold-soft`, `--rose` em texto secundário, linhas `--hairline`) e substituir cores fixas em `rise-platform.tsx` por tokens.
- Componente `<RiseLogo variant="light|brand" />` reutilizado nas telas.
- Validar visualmente as telas com captura de tela.
