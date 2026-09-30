# Segurança da RISE NOW

A plataforma contém informações pessoais, reflexões de carreira e materiais privados. Segurança e privacidade fazem parte do produto, não são uma configuração opcional.

## Princípios implementados

- Não existe cadastro público.
- E-mails são normalizados e precisam constar como aprovados antes da criação do usuário.
- A função do usuário vem do banco; nunca é aceita como verdade a partir do navegador.
- Row Level Security (RLS) limita cada mentorada aos próprios dados e cada mentora às mentoradas atribuídas.
- Notas privadas não são expostas fora da visibilidade definida.
- Arquivos ficam em bucket privado e usam o UUID da proprietária como primeiro segmento do caminho.
- Alterações de convites e funções produzem registros de auditoria pelo banco.
- O modo demonstração usa somente dados fictícios e não altera permissões.

## Segredos

- `.env` e variantes locais não entram no Git.
- A chave pública/publishable do Supabase pode ser usada pelo navegador porque a proteção depende de RLS.
- `SUPABASE_SERVICE_ROLE_KEY` nunca pode ser enviada ao cliente, prefixada com `VITE_`, colocada no Git ou inserida em prompts.
- Convites, criação de usuários e alterações administrativas sensíveis devem ocorrer em código server-side ou Edge Function.

## Checklist antes de produção

- Aplicar e validar todas as migrations no banco correto.
- Criar o primeiro administrador por procedimento server-side controlado.
- Implementar o convite administrativo chamando `inviteUserByEmail` apenas no servidor.
- Configurar domínio e URLs de redirecionamento permitidas no Supabase Auth.
- Ativar MFA para administradoras e, se disponível no plano, exigir MFA para ações sensíveis.
- Revisar políticas RLS com testes positivos e negativos para admin, mentora e mentorada.
- Restringir CORS e origens autorizadas ao domínio final.
- Configurar limites de tamanho e tipos de arquivo aceitos.
- Definir retenção, backup, exportação e exclusão de dados em conformidade com a LGPD.
- Ativar alertas, logs e rotina de revisão de acessos.
- Fazer revisão independente de segurança antes de receber dados reais.

## Comunicação de vulnerabilidades

Não publique detalhes de vulnerabilidades em issues abertas. Comunique o incidente diretamente à responsável administrativa da RISE NOW e revogue imediatamente qualquer credencial potencialmente exposta.
