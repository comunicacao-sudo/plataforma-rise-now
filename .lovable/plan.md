# Ajustar acessos da plataforma

## Resultado
| E-mail | Papel | Senha |
|---|---|---|
| camilaum@pamarisdigital.com | Administradora (nova) | camilaum@2026 |
| camila@pamaris.com.br | Administradora (nova) | camila@p4m4r1s |
| analuiza3727@icloud.com | Administradora (mantém) | sem mudança |
| comunicacao@pamarisdigital.com | Mentorada (deixa de ser administradora) | sem mudança |

- As duas contas novas entram direto com a senha informada, sem troca obrigatória no primeiro acesso (você definiu a senha).
- Comunicação passa a ver somente a área da mentorada; recebe uma matrícula na jornada de 6 meses para a tela inicial funcionar.
- Toda mudança fica registrada no histórico de auditoria.

## Detalhes técnicos
- Inserir os dois e-mails novos em `allowed_emails` (role admin, approved) e criar as contas pela API admin com `email_confirm: true` e sem `must_change_password`; o gatilho cria perfil e papel.
- comunicacao: `allowed_emails.role = mentee`, remover `user_roles` admin, inserir mentee, criar `enrollments` no programa existente.
- Testar login das contas novas e confirmar que Comunicação abre a área da mentorada.
- Atualizar a memória das administradoras.
