# Ajustar contas de administradoras

## O que será feito

A plataforma tem hoje três acessos de administradora; você confirmou que as usuárias são apenas duas. Os ajustes:

1. **Remover o acesso `analuiza3727@gmail.com`** — conta de login, papel de admin e registro na lista de e-mails aprovados. Ficam só:
   - analuiza3727@icloud.com
   - comunicacao@pamarisdigital.com
2. **Atualizar os nomes exibidos na plataforma**:
   - analuiza3727@icloud.com → **Ana Luiza Fernandes Mendes**
   - comunicacao@pamarisdigital.com → **Comunicação**

As duas contas restantes não mudam: continuam com papel de administradora, e-mail já confirmado e a senha inicial `rise@2026` com troca obrigatória no primeiro acesso (a da Ana Luiza no iCloud já passou pelo primeiro acesso).

## Como será feito (detalhe técnico)

- Exclusão da conta gmail via API de administração (auth.users) e limpeza das linhas em `allowed_emails`, `user_roles` e `profiles`.
- Atualização de `full_name` em `allowed_emails` e `profiles` para as duas administradoras.
- Verificação final no banco: só duas administradoras ativas, com os nomes corretos.
