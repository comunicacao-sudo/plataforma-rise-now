import { ArrowRight, Monitor, Share2, Smartphone } from "lucide-react";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { LegalFooterLinks } from "@/components/rise-legal";
import { usePwa } from "@/lib/pwa";

export function InstallRisePage() {
  const { standalone } = usePwa();
  return (
    <div className="rise-public-shell rise-install-page">
      <a className="rise-public-skip" href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className="rise-public-header">
        <a href="/" className="rise-public-brand" aria-label="RISE NOW — acessar a plataforma">
          <img
            className="rise-public-brand__dark"
            src="/brand/rise-logo-white-app.webp"
            width="92"
            height="72"
            alt="RISE NOW"
          />
          <img
            className="rise-public-brand__light"
            src="/brand/rise-logo-light-app.webp"
            width="92"
            height="72"
            alt=""
            aria-hidden="true"
          />
        </a>
        <a className="rise-public-access" href="/">
          Acessar a plataforma
        </a>
      </header>
      <main className="rise-install-page__main" id="conteudo">
        <img
          className="rise-install-page__icon"
          src="/app-icons/icon-192.png"
          width="88"
          height="88"
          alt=""
        />
        <span className="rise-public-eyebrow">RISE NOW · Seu aplicativo</span>
        <h1>Sua mentoria na tela inicial</h1>
        <p className="rise-install-page__intro">
          Instale a RISE no celular ou no computador e acesse aulas, encontros e sua jornada com o
          mesmo login da plataforma.
        </p>
        {standalone ? (
          <p className="rise-install-page__notice" role="status">
            Se você já abriu pelo ícone da RISE, pode acessar a plataforma pelo botão abaixo.
          </p>
        ) : (
          <PwaInstallButton />
        )}
        <p className="rise-install-page__notice">
          <strong>Abriu pelo WhatsApp?</strong> Use o menu para abrir este link no Chrome, no
          Android, ou no Safari, no iPhone. Depois, siga os passos abaixo.
        </p>
        <nav
          className="rise-install-page__devices"
          aria-label="Ir para o tutorial do seu dispositivo"
        >
          <a href="#android">Android</a>
          <a href="#iphone">iPhone e iPad</a>
          <a href="#computador">Computador</a>
        </nav>
        <section
          id="android"
          className="rise-install-page__section"
          aria-labelledby="android-title"
        >
          <h2 id="android-title">
            <Smartphone size={24} aria-hidden="true" /> No Android
          </h2>
          <ol>
            <li>
              Abra este link no <strong>Google Chrome</strong>.
            </li>
            <li>
              Toque em <strong>Instalar aplicativo</strong>, quando o convite aparecer, ou abra o
              menu de <strong>três pontos ⋮</strong> do Chrome.
            </li>
            <li>
              Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong> e
              confirme.
            </li>
            <li>
              Abra pelo ícone <strong>RISE NOW</strong> e entre com seu e-mail e senha.
            </li>
          </ol>
        </section>
        <section id="iphone" className="rise-install-page__section" aria-labelledby="iphone-title">
          <h2 id="iphone-title">
            <Share2 size={24} aria-hidden="true" /> No iPhone e iPad
          </h2>
          <ol>
            <li>
              Abra este link no <strong>Safari</strong>.
            </li>
            <li>
              Toque em <strong>Compartilhar</strong>, o quadrado com uma seta para cima.
            </li>
            <li>
              Role as opções e escolha <strong>Adicionar à Tela de Início</strong>. Se aparecer{" "}
              <strong>Abrir como App</strong>, mantenha essa opção ativada.
            </li>
            <li>
              Toque em <strong>Adicionar</strong>. Abra a RISE pelo ícone criado e entre com seu
              e-mail e senha.
            </li>
          </ol>
        </section>
        <section
          id="computador"
          className="rise-install-page__section"
          aria-labelledby="computador-title"
        >
          <h2 id="computador-title">
            <Monitor size={24} aria-hidden="true" /> No computador
          </h2>
          <ol>
            <li>
              Abra a RISE no <strong>Chrome</strong> ou <strong>Microsoft Edge</strong>.
            </li>
            <li>
              Use <strong>Instalar aplicativo</strong> ou procure a instalação no menu ou na barra
              de endereço do navegador.
            </li>
            <li>
              No Mac com Safari compatível, use <strong>Arquivo → Adicionar ao Dock</strong>.
            </li>
            <li>Confirme e abra pelo ícone da RISE.</li>
          </ol>
        </section>
        <aside className="rise-install-page__notes" aria-label="Informações sobre o aplicativo">
          <p>
            O aplicativo precisa de internet. Aulas e materiais continuam na plataforma, sem
            downloads automáticos para o celular.
          </p>
          <p>
            As melhorias chegam pelo próprio site. Ao abrir pelo ícone pela primeira vez, pode ser
            necessário entrar novamente.
          </p>
          <p>Os nomes das opções podem variar conforme a versão do navegador.</p>
        </aside>
        <a className="rise-install-page__access" href="/">
          Acessar a plataforma <ArrowRight size={19} aria-hidden="true" />
        </a>
      </main>
      <footer className="rise-public-footer">
        <span>© 2026 RISE NOW</span>
        <LegalFooterLinks />
      </footer>
    </div>
  );
}
