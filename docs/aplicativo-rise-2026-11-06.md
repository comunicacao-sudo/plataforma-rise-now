# Aplicativo instalável RISE NOW

A RISE pode ser instalada pelo navegador no computador e no celular, com ícone próprio e abertura em janela independente. Essa implementação segue o formato PWA também utilizado no Clube do Empresário Caro. A distribuição é pelo endereço oficial da plataforma; publicação em lojas é uma etapa separada.

## Como instalar

Abra https://board.mentoriarisenow.com.br e use **Instalar aplicativo**, abaixo do formulário de entrada. Depois do login, a opção também está no menu do perfil, no canto superior direito.

- **Windows, Linux ou Mac com Chrome/Edge:** confirme a instalação oferecida pelo navegador. Caso ela não seja oferecida, o botão mostra os passos para usar o menu ou a barra de endereço.
- **Android:** abra no Chrome e use Instalar aplicativo. Também pode usar o menu de três pontos → Instalar aplicativo / Adicionar à tela inicial.
- **iPhone e iPad:** abra no Safari → Compartilhar → Adicionar à Tela de Início → Adicionar. Não existe o mesmo convite programável de instalação do Chrome nesse sistema.
- **Mac com Safari 17 ou posterior:** Arquivo → Adicionar ao Dock.

Use o mesmo e-mail e senha da mentoria. Conforme o navegador e o sistema, pode ser necessário entrar novamente na primeira abertura do aplicativo. O botão é ocultado quando a plataforma está aberta em modo aplicativo; isso não tenta adivinhar se há uma instalação aberta em outro navegador.

## Funcionamento e atualização

Aulas, agenda, diagnósticos e atividades precisam de internet. Sem conexão, o app mostra uma tela pública com orientação e o botão Tentar novamente. A versão online continua usando as mesmas permissões e operações do site.

O service worker armazena apenas `/offline.html` e dois ícones públicos. Não armazena páginas autenticadas, credenciais, APIs, questionários, diagnósticos, capas privadas ou vídeos. O HTML online sempre vem da rede. O registro é feito em segundo plano, somente em produção e em contexto seguro, fora de incorporações do editor. Atualizações do worker não provocam recarga automática de formulários. Ao alterar recursos públicos pré-armazenados no futuro, deve-se incrementar a versão do cache em `public/sw.js`.

O manifesto e o worker recebem cabeçalhos de revalidação, enquanto os arquivos de código com hash mantêm o cache imutável da plataforma.

## Verificações

- 95 testes automatizados passaram, incluindo isolamento do cache, navegação online/offline, identificação de dispositivos e dimensões dos ícones.
- Tipos, lint e compilação passaram. A entrada pública continua abaixo de 110 KB gzip e a entrada autenticada abaixo de 55 KB gzip.
- 14 cenários no navegador passaram: manifesto aceito pelo Chromium sem erros de instalabilidade; instruções em ambos os temas e larguras de desktop/celular; ausência de rolagem horizontal e erros de contraste; convite simulado, recusa, evento de instalação; cache público conferido; queda e retorno da conexão; instruções específicas por dispositivo; menus dos dois perfis; modo aplicativo sem convite repetido.
- A inspeção visual conferiu os ícones e o diálogo de instalação.

Os testes de convite e instruções usam eventos e identificação de dispositivos simulados em Chromium. Não equivalem a instalar fisicamente em um iPhone, Android, Windows ou Mac. A confirmação visual da instalação no dispositivo da usuária permanece como verificação de uso.

Referências: [instalação e compatibilidade](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [convite de instalação](https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent), [service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).
