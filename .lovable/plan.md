# Ajuste final do pacote de migração das capas

## O que muda
- O pacote corrigido continua com 23 capas válidas (incluindo a capa recuperada de "RISE Decision Room"), o avatar da Ana Luiza em JPEG, manifest.json e manifest.csv.
- "Next Level Lab, Consistência" passa a constar no manifesto como etapa válida e distinta, **sem arquivo de capa disponível no legado**. Nenhuma capa é reutilizada para ela, nem a de "Next Level Lab".
- O aviso "pendente de decisão humana", que tratava a etapa como possível título duplicado, sai do manifesto.

## O que não muda
- Nada é apagado ou alterado no Lovable Cloud (contas, banco, Storage, caminhos de capa).
- Nada é enviado ao banco oficial e nenhuma imagem vai para o GitHub.

## Entrega
- O arquivo atual rise-now-storage-migration-corrected.zip é substituído, em Arquivos, pela versão com o manifesto atualizado. A contagem final de arquivos e os códigos de conferência (SHA-256) são conferidos antes de liberar o download.

## Detalhes técnicos
- manifest.json: incluir `steps_without_cover` com o título, o pilar (Evolução), o journey_step_id antigo (34f899ea-04ff-46e8-8c63-49005235a12b), o stable_key antigo (dbb3cc2d-f9f7-4358-889f-9483f513295a) e o motivo "sem arte individual no Storage legado"; remover `pending_human_decision`; remover o texto "Substitui a etapa..." do correction_note da capa de RISE Decision Room.
- manifest.csv: adicionar uma linha `type=step_without_cover`, com os campos de arquivo em branco.
- As imagens são as mesmas do pacote atual (23 capas + 1 avatar); conferir que os SHA-256 continuam iguais.
