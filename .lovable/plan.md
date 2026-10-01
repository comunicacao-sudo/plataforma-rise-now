# Corrigir o erro ao salvar a nova senha no primeiro acesso

## O que aconteceu
Os acessos com a senha inicial funcionaram: o backend registra a entrada de duas das contas. O erro aparece só no passo seguinte, ao salvar a nova senha, e a senha inicial continua valendo.

O backend não deixa uma pessoa já conectada trocar a senha sem informar também a senha atual, e a tela de primeiro acesso não está enviando essa informação. Essa é a causa mais provável, mas ainda não confirmei. Por isso, o primeiro passo é reproduzir o erro e ler a mensagem exata.

## O que vai mudar
- **Tela "Crie sua nova senha" no primeiro acesso:** envia junto, de forma automática, a senha atual que a pessoa acabou de usar para entrar. Ela não precisa digitar de novo.
- **Página "Esqueci minha senha":** continua sem pedir a senha atual, porque o link do e-mail já comprova quem é a pessoa.
- **Mensagens de erro mais claras:** em vez de "Tente novamente", a tela vai dizer o motivo. Por exemplo: senha fraca demais, senha já usada ou sessão expirada.

## Como testar
1. Entrar com um dos e-mails e a senha `rise@2026`.
2. Criar a nova senha e confirmar que o painel administrativo abre.
3. Sair e entrar de novo com a nova senha.

## Detalhes técnicos
- Reproduzir com Playwright e registrar o erro real retornado por `updateUser`.
- Em `LoginScreen`, guardar em memória a senha digitada quando `must_change_password` estiver marcado e passar essa senha para `NewPasswordScreen`.
- No primeiro acesso, chamar `updateUser({ password, current_password, data: { must_change_password: false } })`. Em `/reset-password`, manter a chamada sem `current_password`.
- Traduzir os códigos de erro mais comuns: `weak_password`, `same_password`, `reauthentication_needed`/senha atual exigida e sessão ausente.
- Se a sessão se perder ao recarregar a página, pedir também o campo "Senha atual" nessa tela como alternativa.
