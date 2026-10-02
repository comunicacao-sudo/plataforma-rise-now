# Redefinir a senha da conta da Comunicação (mentorada)

## O que aconteceu
O login da mentorada `comunicacao@pamarisdigital.com` não está entrando — provavelmente a senha foi trocada em algum teste anterior e ninguém lembra a nova.

## O que vai mudar
- **Redefinir a senha** da conta da Comunicação para uma nova senha provisória, sem troca obrigatória no primeiro acesso.
- **Testar o login** com a nova senha e confirmar que a área da mentorada abre normalmente (Início, Minha jornada, Agenda, Entregas e RISE 90).
- Te entregar a nova senha aqui no chat para você repassar.

## Detalhes técnicos
- Usar a API administrativa do backend (`auth.admin.updateUserById`) para definir a nova senha e limpar `must_change_password`.
- Registrar a redefinição no histórico de auditoria (`audit_log`).
- Validar o acesso via Playwright com a nova senha.
