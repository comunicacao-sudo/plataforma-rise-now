import type { ReactNode } from "react";

const supportEmail = "ana@pamarisdigital.com";

export function LegalFooterLinks() {
  return (
    <nav className="rise-legal-links" aria-label="Documentos e informações legais da RISE Now">
      <a href="/politica-de-privacidade">Política de Privacidade</a>
      <span aria-hidden="true">·</span>
      <a href="/termos-de-uso">Termos de Uso</a>
    </nav>
  );
}

function PublicPageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rise-public-shell">
      <a className="rise-public-skip" href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className="rise-public-header">
        <a className="rise-public-brand" href="/sobre" aria-label="RISE Now — sobre a plataforma">
          <img
            className="rise-public-brand__dark"
            src="/brand/rise-logo-white-app.webp"
            width="92"
            height="72"
            alt="RISE Now"
          />
          <img
            className="rise-public-brand__light"
            src="/brand/rise-logo-marsala-app.webp"
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
      <main className="rise-public-main" id="conteudo">
        <div className="rise-public-heading">
          <span className="rise-public-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <article className="rise-public-document">{children}</article>
      </main>
      <footer className="rise-public-footer">
        <span>© 2026 RISE Now</span>
        <LegalFooterLinks />
      </footer>
    </div>
  );
}

export function AboutRisePage() {
  return (
    <PublicPageShell
      eyebrow="RISE Now · Mentoria executiva"
      title="Uma jornada de desenvolvimento que começa por dentro."
      description="Ambiente digital da mentoria RISE Now, dedicado à reflexão, identidade, segurança e evolução."
    >
      <section>
        <h2>Sobre a plataforma</h2>
        <p>
          A RISE Now reúne conteúdos, etapas de desenvolvimento, atividades, encontros e
          acompanhamento da jornada de mentoria. O acesso às áreas privadas é destinado a pessoas
          convidadas e cadastradas pela equipe responsável.
        </p>
      </section>
      <section>
        <h2>Integração com Google Agenda</h2>
        <p>
          Quando uma pessoa escolhe conectar sua conta Google, a RISE Now pode utilizar a
          autorização concedida para apoiar o agendamento e o gerenciamento de encontros da
          mentoria. A conexão é individual, opcional e pode ser desfeita.
        </p>
        <p>
          Saiba quais informações são utilizadas e como solicitar a revogação de acesso na nossa{" "}
          <a href="/politica-de-privacidade">Política de Privacidade</a>.
        </p>
      </section>
      <section>
        <h2>Contato</h2>
        <p>
          Dúvidas sobre o aplicativo e seu funcionamento podem ser encaminhadas para{" "}
          <a href={"mailto:" + supportEmail}>{supportEmail}</a>.
        </p>
      </section>
    </PublicPageShell>
  );
}

export function PrivacyPolicyPage() {
  return (
    <PublicPageShell
      eyebrow="Transparência e proteção de dados"
      title="Política de Privacidade"
      description="Entenda como a plataforma RISE Now trata informações pessoais e os dados relacionados à integração opcional com o Google Agenda."
    >
      <p className="rise-public-updated">Última atualização: 24 de outubro de 2026.</p>
      <section>
        <h2>1. Quem somos e contato</h2>
        <p>
          A RISE Now é uma plataforma digital de acompanhamento de mentoria. O tratamento dos dados
          é conduzido pela organização responsável pela operação da mentoria, nos limites das
          atividades descritas nesta política.
        </p>
        <p className="rise-public-review">
          <strong>Informação pendente de validação antes da publicação:</strong> identificar a razão
          social e o CNPJ da pessoa jurídica controladora dos dados, bem como confirmar o canal
          oficial para solicitações de privacidade.
        </p>
        <p>
          Canal de suporte atualmente informado pela RISE Now:{" "}
          <a href={"mailto:" + supportEmail}>{supportEmail}</a>.
        </p>
      </section>
      <section>
        <h2>2. Quais informações podem ser tratadas</h2>
        <ul>
          <li>
            Dados cadastrais e de contato, como nome, e-mail, telefone, cargo e foto de perfil.
          </li>
          <li>Informações de participação na mentoria, como turma, etapas, aulas e progresso.</li>
          <li>
            Respostas a questionários, avaliações, planos de desenvolvimento e entregas realizadas.
          </li>
          <li>Informações sobre encontros, convites, datas, horários e links de reuniões.</li>
          <li>
            Dados técnicos necessários à autenticação, ao funcionamento e à segurança do serviço.
          </li>
          <li>
            Se a pessoa optar por conectar o Google, dados de identificação e autorização descritos
            abaixo.
          </li>
        </ul>
      </section>
      <section>
        <h2>3. Por que usamos os dados</h2>
        <p>
          As informações são utilizadas para manter o cadastro e o acesso autorizado, organizar a
          jornada de mentoria, apresentar conteúdos e avaliações, registrar progresso, viabilizar
          encontros, prestar suporte e proteger a plataforma contra usos indevidos.
        </p>
        <p>
          O tratamento poderá se apoiar, conforme a finalidade específica, na execução de contratos
          ou procedimentos relacionados à mentoria, em obrigações legais, em interesses legítimos
          devidamente avaliados e no consentimento, quando aplicável.
        </p>
      </section>
      <section>
        <h2>4. Como funciona a conexão com o Google Agenda</h2>
        <p>
          A conexão é iniciada pelo próprio usuário. O Google apresenta os dados e permissões
          solicitados para que a pessoa decida se deseja autorizar o acesso. A implementação atual
          solicita os escopos de identificação básica (openid, e-mail e perfil) e o escopo de
          eventos do Google Agenda (calendar.events).
        </p>
        <p>
          A autorização de eventos permite tecnicamente visualizar e gerenciar eventos nas agendas
          autorizadas. Na implementação atual da RISE Now, a integração utiliza essa permissão para
          criar e cancelar eventos vinculados a encontros da mentoria a partir de ações de usuários
          autorizados; a plataforma não importa automaticamente uma lista completa de compromissos
          pessoais.
        </p>
        <p>
          Ao criar um encontro, dados pertinentes ao convite, como título, descrição, horário e
          e-mails de participantes, podem ser enviados ao Google para disponibilizar o evento e
          notificar as pessoas convidadas.
        </p>
        <p>
          As credenciais de autorização recebidas do Google são armazenadas de forma criptografada
          no backend, vinculadas individualmente à conta que autorizou a integração. O acesso à
          conta Google não exige compartilhar sua senha com a RISE Now.
        </p>
      </section>
      <section>
        <h2>5. Compartilhamento e fornecedores</h2>
        <p>
          Dados necessários à realização da mentoria podem ser acessados por integrantes autorizados
          da equipe e pelas mentoras responsáveis, respeitando os perfis de acesso da plataforma.
          Fornecedores de infraestrutura, autenticação, armazenamento, comunicações e integração de
          agenda podem tratar dados estritamente para prestar esses serviços.
        </p>
        <p>
          Os dados obtidos por meio das APIs do Google não são utilizados para publicidade
          personalizada, comercialização de informações ou treinamento de modelos de inteligência
          artificial. O uso desses dados está limitado às funcionalidades da integração descritas
          aqui.
        </p>
      </section>
      <section>
        <h2>6. Segurança, armazenamento e retenção</h2>
        <p>
          A plataforma emprega mecanismos de autenticação, controles de acesso e proteção das
          credenciais de conexão. Nenhum sistema elimina completamente os riscos de segurança, por
          isso procedimentos e medidas de proteção podem ser aprimorados ao longo do tempo.
        </p>
        <p>
          Os dados são mantidos pelo período necessário às finalidades informadas e, quando cabível,
          ao cumprimento de obrigações legais, à defesa de direitos e à preservação da segurança da
          plataforma. A duração concreta dependerá da categoria dos dados e das condições aplicáveis
          à mentoria.
        </p>
        <p>
          O uso de fornecedores de tecnologia pode envolver tratamento de informações em outras
          localidades, conforme a infraestrutura contratada e as salvaguardas exigidas pela
          legislação aplicável.
        </p>
      </section>
      <section>
        <h2>7. Seus direitos e a desconexão do Google</h2>
        <p>
          Nos termos da legislação de proteção de dados, a pessoa pode solicitar, conforme o caso,
          confirmação do tratamento, acesso, correção, informações sobre compartilhamento,
          portabilidade, oposição, anonimização, bloqueio ou eliminação de dados, além de revogar
          consentimentos aplicáveis.
        </p>
        <p>
          A conta Google pode ser desconectada pela funcionalidade disponibilizada na RISE Now. A
          plataforma remove o vínculo armazenado e solicita a revogação da credencial ao Google. A
          autorização também pode ser revogada diretamente nas configurações de segurança da conta
          Google. Eventos já criados poderão continuar existindo no Google Agenda até serem
          removidos pelo responsável.
        </p>
        <p>
          Para solicitações relacionadas a dados pessoais, entre em contato pelo e-mail{" "}
          <a href={"mailto:" + supportEmail}>{supportEmail}</a>.
        </p>
      </section>
      <section>
        <h2>8. Atualizações desta política</h2>
        <p>
          Esta política poderá ser atualizada para refletir mudanças no serviço, em suas integrações
          ou na legislação. Alterações relevantes sobre o uso de dados do Google serão comunicadas
          de maneira apropriada antes de ocorrer um novo tratamento que exija autorização adicional.
        </p>
      </section>
    </PublicPageShell>
  );
}

export function TermsOfUsePage() {
  return (
    <PublicPageShell
      eyebrow="Condições de uso"
      title="Termos de Uso"
      description="Regras gerais para utilização da plataforma digital da mentoria RISE Now."
    >
      <p className="rise-public-updated">Última atualização: 24 de outubro de 2026.</p>
      <section>
        <h2>1. Sobre a plataforma</h2>
        <p>
          A RISE Now disponibiliza um ambiente digital para acompanhar uma jornada de mentoria,
          acessar conteúdos e atividades e organizar encontros. O acesso às áreas privadas depende
          de cadastro autorizado.
        </p>
        <p className="rise-public-review">
          <strong>Informação pendente de validação antes da publicação:</strong> incluir razão
          social e CNPJ da pessoa jurídica responsável pela operação da RISE Now e validar estes
          termos com a equipe responsável.
        </p>
      </section>
      <section>
        <h2>2. Acesso e responsabilidade da conta</h2>
        <p>
          Cada conta é pessoal. O usuário deve manter suas credenciais em sigilo, fornecer
          informações corretas e comunicar à equipe situações suspeitas relacionadas ao acesso. Não
          é permitido acessar a conta de terceiros sem autorização.
        </p>
      </section>
      <section>
        <h2>3. Conteúdos e participação na mentoria</h2>
        <p>
          As aulas, materiais, questionários, registros de acompanhamento e demais conteúdos
          destinam-se às pessoas autorizadas. O usuário deve respeitar os direitos autorais, a
          privacidade de outros participantes e as orientações aplicáveis às atividades e encontros.
        </p>
        <p>
          O cronograma, a disponibilidade de conteúdos e as condições comerciais específicas da
          mentoria são estabelecidos nos instrumentos próprios da contratação e nas comunicações
          oficiais aplicáveis.
        </p>
      </section>
      <section>
        <h2>4. Integração opcional com o Google Agenda</h2>
        <p>
          O usuário pode autorizar o vínculo de sua conta Google para as funcionalidades de
          agendamento disponibilizadas. A autorização é individual e pode ser revogada. O
          funcionamento da integração também depende da disponibilidade dos serviços do Google e das
          permissões concedidas pelo titular da conta.
        </p>
        <p>
          Os dados acessados e as opções de desconexão são explicados na{" "}
          <a href="/politica-de-privacidade">Política de Privacidade</a>.
        </p>
      </section>
      <section>
        <h2>5. Uso adequado e segurança</h2>
        <p>
          Não é permitido tentar violar controles de acesso, explorar falhas, distribuir código
          malicioso, utilizar contas de outras pessoas ou divulgar indevidamente informações
          privadas de outros participantes. O acesso poderá ser restringido em situações
          justificadas de risco, uso indevido ou encerramento do vínculo com a mentoria, conforme as
          regras aplicáveis.
        </p>
      </section>
      <section>
        <h2>6. Disponibilidade e mudanças</h2>
        <p>
          A equipe responsável poderá realizar manutenção, corrigir falhas e atualizar
          funcionalidades. Interrupções técnicas ou indisponibilidade de serviços de terceiros
          poderão afetar temporariamente o acesso.
        </p>
      </section>
      <section>
        <h2>7. Privacidade e atendimento</h2>
        <p>
          O tratamento de dados pessoais segue as informações apresentadas na{" "}
          <a href="/politica-de-privacidade">Política de Privacidade</a>. Para dúvidas ou suporte,
          escreva para <a href={"mailto:" + supportEmail}>{supportEmail}</a>.
        </p>
      </section>
      <section>
        <h2>8. Alterações</h2>
        <p>
          Estes termos poderão ser atualizados de acordo com mudanças na plataforma, na operação da
          mentoria ou em exigências legais. Alterações relevantes deverão ser comunicadas de forma
          apropriada.
        </p>
      </section>
    </PublicPageShell>
  );
}

