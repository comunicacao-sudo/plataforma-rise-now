# RISE NOW — Plataforma da Mentoria

Plataforma privada de acompanhamento da jornada RISE NOW. A experiência da mentorada foi desenhada como um ambiente de conteúdo premium, inspirado na navegação de streaming, e não como site de vendas ou CRM.

## O que existe nesta primeira versão

- Tela de acesso exclusiva por e-mail aprovado, sem cadastro público.
- Experiência da mentorada com início cinematográfico, trilha de seis meses, agenda, entregáveis e RISE 90.
- Área unificada de mentora e administradora com gestão da jornada, agenda, entregas, turmas e acessos.
- Integração de autenticação com o Supabase/Lovable Cloud.
- Modelo de dados para conteúdos, progresso, encontros, entregas, notas privadas e plano RISE 90.
- Regras de acesso por função e armazenamento privado preparadas em migrations SQL.
- Layout responsivo para computador e celular.

O acesso é restrito a contas aprovadas. Não existe rota pública de demonstração nem dados fictícios na experiência publicada.

## Fluxo de desenvolvimento

O GitHub é a fonte oficial do código. O repositório está conectado ao projeto no Lovable, portanto todo `push` para a branch `main` sincroniza as alterações com o editor sem consumir créditos de geração.

- Repositório: <https://github.com/comunicacao-sudo/plataforma-rise-now>
- Projeto Lovable: <https://lovable.dev/projects/8338b475-316e-4d97-83aa-16de6334c11e>

Evite editar a mesma parte do código simultaneamente no Lovable e localmente. Nunca reescreva o histórico publicado da `main`.

## Desenvolvimento local

Requisitos: Node.js 20+ e npm.

```bash
npm install
copy .env.example .env
npm run dev
```

Preencha no `.env` apenas a URL e a chave pública do projeto. A chave `service_role` é exclusivamente de servidor e nunca deve ter o prefixo `VITE_`.

Comandos de validação:

```bash
npm run lint
npm run build
```

## Banco e segurança

As migrations ficam em `drizzle/migrations`:

- `0000_rise_now_core_schema.sql`: estrutura inicial e políticas RLS.
- `0001_secure_invites_and_private_storage.sql`: validação de convite, endurecimento das permissões, auditoria e bucket privado.

Importante: enviar uma migration ao GitHub não a executa automaticamente no Lovable Cloud. Antes de liberar usuários reais, a migration `0001` precisa ser revisada e aplicada no banco conectado, e o primeiro administrador deve ser criado por um fluxo server-side seguro.

Consulte [SECURITY.md](SECURITY.md) antes de publicar a plataforma.

## Identidade visual

- Marsala: `#5A0F14`
- Rosé: `#99666B`
- Dourado: `#D0AC5C`
- Tipografia: Montserrat

As fontes locais estão em `public/fonts` e incluem a licença OFL.
