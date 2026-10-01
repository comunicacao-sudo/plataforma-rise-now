# Novo acesso de administradora: Gabriela

- **gabriela.ribeirogrs250104@gmail.com** passa a ser administradora, com senha **gabriela@2026**.
- Entra direto com essa senha, sem troca obrigatória no primeiro acesso (mesmo padrão das contas da Camila).
- Teste de login ao final.

## Detalhes técnicos
- Inserir em `allowed_emails` (role admin, approved, nome Gabriela Ribeiro); criar conta pela API admin com `email_confirm: true`; o gatilho cria perfil e papel.
- Conferir papel admin em `user_roles` e atualizar a memória das administradoras.
