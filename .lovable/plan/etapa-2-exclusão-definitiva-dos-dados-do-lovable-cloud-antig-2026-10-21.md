# Etapa 2: exclusão definitiva dos dados do Lovable Cloud antigo

Alvo único: **vfkvdkqjwnmhxhlfrqba**. Antes de cada passo, confiro de novo esse identificador. Se aparecer `riakceytqrlvdcgcwfdx`, paro na hora.

## O que será apagado
1. **Arquivos:** as 30 capas do journey-content e a 1 foto do avatars, apagadas pela ferramenta de arquivos. Os 4 buckets continuam existindo, vazios.
2. **Dados:** todas as linhas das tabelas do banco antigo, entre elas matrículas, progresso, caderno, questionário, histórico, trilha (116 etapas e 20 versões), aulas, meses, entregas, pilares, especialidades, programa, turma, conexões Google, configuração de WhatsApp, e-mails aprovados, papéis e perfis.
3. **Contas de login:** as 7 contas, removidas uma a uma pela ferramenta de administração de contas, sem mexer direto nas tabelas internas do sistema.

## O que não muda
Tabelas, estrutura do banco, migrations, regras de acesso, buckets, configurações, GitHub, código, site publicado, domínio e o banco oficial.

## Depois
- Refaço todas as contagens (o esperado é zero), confirmo os arquivos vazios e as contas removidas.
- Abro board.mentoriarisenow.com.br (HTTP 200) e confiro de novo que os arquivos do site citam só `riakceytqrlvdcgcwfdx`.
- Envio o relatório ANTES → DEPOIS.

## Detalhes técnicos
- As linhas saem pela ferramenta de dados, com DELETE ... WHERE true em cada tabela pública. A ordem é das tabelas filhas para as pais, e profiles vai por último.
- Os arquivos saem pela API de Storage e as contas pela API admin de Auth, as duas usando a chave de serviço do projeto vfkv.
- Não haverá migration, DROP nem TRUNCATE.
