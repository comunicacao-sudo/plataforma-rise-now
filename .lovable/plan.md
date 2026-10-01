# Acesso de administradora para dois e-mails

## O que vai mudar
- **analuiza3727@gmail.com** e **comunicacao@pamarisdigital.com** entram na lista de acessos aprovados com a função **administradora**.
- Na tela de acesso, cada uma digita o próprio e-mail e recebe um link de entrada na caixa de e-mail. Não há senha. É assim que a tela de acesso já funciona hoje.
- No primeiro acesso, a conta é criada e recebe automaticamente a função de administradora, com acesso ao painel administrativo.

## Como testar
1. Abrir a tela de acesso e digitar um dos dois e-mails.
2. Clicar no link recebido por e-mail.
3. Confirmar que o painel administrativo abre.

## Detalhes técnicos
- Adicionar duas linhas em `allowed_emails` (e-mail em minúsculas, `role = 'admin'`, `status = 'approved'`) usando a ferramenta de dados, não uma migration.
- Ativar o login por e-mail (link mágico) no backend, caso ainda esteja desligado.
- Se alguma dessas contas já existir, adicionar também o papel `admin` em `user_roles` para ela.
- Conferir que o painel lê a função de administradora do banco depois do login, e não do modo demonstração.
