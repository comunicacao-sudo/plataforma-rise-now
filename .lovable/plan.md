# Senha inicial e e-mail de primeiro acesso para as administradoras

Vale para analuiza3727@gmail.com, comunicacao@pamarisdigital.com e analuiza3727@icloud.com.

## O que vai mudar
- **Contas criadas com a senha inicial `rise@2026`.** As três já ficam ativas, sem precisar confirmar o e-mail.
- **Tela de acesso com duas opções:** entrar com e-mail e senha, ou continuar recebendo o link por e-mail, como hoje.
- **Troca obrigatória no primeiro acesso.** Ao entrar com a senha inicial, aparece a tela "Crie sua nova senha", com o campo repetido para confirmar. O painel só abre depois da troca, e a senha inicial deixa de funcionar.
- **Link "Esqueci minha senha"** na tela de acesso, com uma página própria para criar uma nova senha.
- **E-mail de boas-vindas para as três**, com o endereço da plataforma, o e-mail de acesso de cada uma e a senha inicial, explicando que ela será trocada na primeira entrada.

## O que preciso de você
- **Um domínio de envio.** Para os e-mails saírem com o nome RISE NOW, é preciso configurar um domínio de envio, como `rise.pamarisdigital.com`. Vou abrir essa configuração para você. Depois disso, o envio sai sozinho.
- **Um aviso de segurança.** Mandar a senha por e-mail é menos seguro, porque qualquer pessoa com acesso a essas caixas de e-mail consegue entrar até a senha ser trocada. A troca obrigatória no primeiro acesso diminui esse risco.

## Detalhes técnicos
- Uma função do servidor, acessível só a administradoras e usada uma vez, cria os usuários pela API administrativa com `email_confirm: true` e a senha inicial, e guarda `user_metadata.must_change_password = true`. O gatilho de convite que já existe atribui o papel `admin`.
- Login com `signInWithPassword`. Quando `must_change_password` estiver marcado, o painel fica bloqueado e aparece um formulário que chama `updateUser({ password, data: { must_change_password: false } })`.
- Criar a página `/reset-password` para recuperação de senha via `resetPasswordForEmail`.
- Configurar o domínio de e-mail, criar os modelos de e-mail de acesso com a identidade marsala/dourado e um modelo de boas-vindas, e enviar para os três endereços.
