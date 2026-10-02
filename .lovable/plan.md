# Botão de avisos e tela "Meu perfil"

## 1. Botão de avisos (sino)
O sino só funcionava na conta da mentorada. Nas contas da equipe, ele era só um enfeite e não fazia nada ao clicar. A correção:
- O sino passa a funcionar em todas as contas.
- A equipe recebe avisos quando:
  - uma aluna **envia uma entrega** (vai para quem é mentora da aluna e para as administradoras);
  - um **encontro** é marcado em que ela é a mentora responsável.
- O ponto dourado só aparece quando há aviso não lido. Clicar leva direto para a tela certa: Entregas, Agenda ou Minha jornada.

## 2. Tela "Meu perfil" (todas as contas)
No menu do nome (canto superior direito), entra a opção **"Meu perfil"**, que abre uma tela elegante com:
- **Foto da conta:** enviar ou trocar. A foto aparece no topo, no menu e nos cards.
- **Nome:** mostra o nome cadastrado e permite alterar.
- **E-mail de acesso:** aparece só para leitura, porque é o login.
- **Cargo ou especialidade** (opcional, ex.: "Mentora de Identidade").
- **Telefone/WhatsApp de contato** e **e-mail de contato**.
- Aviso discreto de quem vê esses dados:
  - Mentoras e administradoras: as mentoradas veem a foto, o nome, o cargo e os contatos.
  - Mentoradas: só a equipe vê os contatos.

### Onde isso aparece
- **Mentorada:** na tela inicial e na Minha jornada, a seção **"Suas mentoras"** mostra cards com foto, nome, especialidade e os botões **WhatsApp** e **E-mail**. Os cards de encontro também mostram a foto da mentora.
- **Equipe:** em **Alunas e turmas** e na tela de RISE 90 da aluna, aparecem a foto e os contatos de cada mentorada.

## Detalhes técnicos
- `profiles` ganha os campos `phone` e `contact_email`. Os campos `avatar_url`, `title` e `full_name` já existem.
- Um gatilho em `profiles` impede alterar `email`, `claimed` e `id` por quem não é administradora. A política de UPDATE atual (dona ou administradora) continua.
- Leitura:
  - Nova função `staff_directory()` (security definer) que devolve só os campos públicos (id, nome, cargo, foto, telefone, e-mail de contato) de quem tem papel admin ou mentor, para qualquer usuária logada.
  - A política SELECT de `profiles` é ampliada com `is_staff()`, para a equipe ver as mentoradas.
  - As mentoradas não leem o perfil de outras mentoradas.
- Fotos: o bucket público `avatars` (fotos de perfil não são sensíveis), com upload só em `avatars/<uid>/...` pela própria dona e limite de 5 MB.
- Avisos para a equipe:
  - Gatilho em `submissions` quando o status vira `enviada` (notifica a mentor_id da enrollment e as administradoras).
  - Gatilho em `meetings` para a `mentor_id`.
  - `NotificationBell` renderizado para todos os papéis, com navegação mapeada por papel.
- Nova tela `ProfileView` (modal ou página) em `rise-extras.tsx`, ligada ao menu do perfil em `rise-platform.tsx`. O avatar do topo passa a usar a foto.
