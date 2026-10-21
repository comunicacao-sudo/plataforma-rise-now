# Diagnóstico dos 7 alertas de segurança

## Onde os alertas foram encontrados
- O verificador do Lovable lê **apenas o banco interno do Lovable Cloud**. Ele não acessa o banco oficial riakceytqrlvdcgcwfdx.
- As mesmas regras estão escritas nas alterações de banco guardadas no repositório. Se essas alterações foram aplicadas no banco oficial, as regras também valem lá. Daqui eu não consigo comprovar isso, porque não tenho acesso de leitura às regras do banco oficial.
- **O site publicado foi conferido.** Os arquivos finais do site citam só o riakceytqrlvdcgcwfdx, e o banco antigo não aparece. Numa tentativa de login, só o riakceytqrlvdcgcwfdx.supabase.co respondeu. A verificação de publicação lê a pasta final do site antes de liberar.

## Os 7 alertas

| # | Alerta | Problema | Onde existe | Afeta produção? | Recomendação | Onde corrigir |
|---|---|---|---|---|---|---|
| 1 | Aulas | Toda pessoa logada lê todas as aulas | Banco interno + regra no repositório (0000) | Provavelmente sim, se a regra foi aplicada no oficial. É uma exposição baixa: conteúdo do programa, sem dados pessoais | Limitar à equipe e às alunas matriculadas no programa | Repositório (nova alteração) → aplicar no Supabase oficial |
| 2 | Pilares da jornada | Toda pessoa logada lê todos os pilares | Banco interno + repositório (0008) | Mesmo caso. Baixo: nomes dos pilares | Manter como está (conteúdo comum a todas) ou limitar ao programa | Decisão sua; se limitar, repositório → oficial |
| 3 | Entregas (modelos) | Toda pessoa logada lê a lista de entregas do programa | Banco interno + repositório (0000) | Mesmo caso. Baixo: títulos das entregas, não as respostas das alunas | Limitar ao programa da aluna e à equipe | Repositório → oficial |
| 4 | Programas | Toda pessoa logada lê todos os programas | Banco interno + repositório (0000) | Mesmo caso. Muito baixo | Limitar ao programa da aluna e à equipe | Repositório → oficial |
| 5 | Especialidades das mentoras | Toda pessoa logada lê a lista de especialidades | Banco interno + repositório (0015) | Mesmo caso. Baixo: lista de nomes, que as alunas já veem nos perfis | Manter, pois é intencional | Sem ação (marcar como intencional) |
| 6 | Meses (fases) | Toda pessoa logada lê todos os meses | Banco interno + repositório (0000) | Mesmo caso. Muito baixo | Limitar ao programa da aluna e à equipe | Repositório → oficial |
| 7 | Fotos de perfil | Qualquer pessoa com o link vê ou lista as fotos | Banco interno + repositório (0006) | Mesmo caso. Intencional: as alunas precisam ver as fotos das mentoras | Manter a leitura das fotos; opcionalmente impedir que alguém veja a lista inteira de arquivos | Sem ação, ou ajuste opcional no repositório → oficial |

Resumo:
- **Nenhum alerta afeta o site publicado em si.** O site só exibe o que o banco libera.
- **Nenhum alerta exige ação no banco interno do Lovable**, porque ele não é usado em produção.
- **Para fechar no banco oficial (recomendado):** alertas 1, 3, 4 e 6.
- **Decisão sua:** alerta 2.
- **Intencionais, sem ação:** alertas 5 e 7.

## O que farei ao aprovar
1. Escrever **um novo arquivo** de alteração no repositório, só com as regras novas dos alertas 1, 3, 4 e 6: leitura apenas para a equipe ou para quem está matriculada no programa. Nenhum arquivo antigo será reescrito, e nenhuma configuração passa a apontar para o banco do Lovable.
2. **Não aplicar** essa alteração em nenhum banco daqui. Ela fica pronta para ser aplicada no Supabase oficial pelo GitHub/Codex.
3. No painel de segurança do Lovable, registrar os alertas como "não se aplica ao banco interno". A explicação dirá que a correção está no repositório, para o banco oficial. Os alertas 5 e 7 ficam registrados como intencionais.

Nenhuma mudança destrutiva: nada será apagado, e o banco oficial não será alterado por mim.

## Detalhes técnicos
- Novo arquivo SQL em `drizzle/migrations/` (não registrado no journal, para o Lovable não o aplicar no banco interno). Ou então em `supabase/migrations/` para o CLI oficial; confirmar com o Codex qual pasta o fluxo de deploy do riakceytqrlvdcgcwfdx usa.
- Políticas: `DROP POLICY IF EXISTS` + `CREATE POLICY ... FOR SELECT TO authenticated USING (public.is_staff() OR EXISTS (select 1 from enrollments e where e.program_id = <tabela>.program_id and e.mentee_id = auth.uid()))`. Phases, lessons e deliverables se ligam ao programa via `phase_id`.
- Achados marcados com `security--manage_security_finding` (ignore, com justificativa), sem `mark_as_fixed`, porque o banco escaneado não muda.
