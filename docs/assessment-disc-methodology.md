# Mapeamento Comportamental RISE inspirado no modelo DISC

## Escopo

O instrumento RISE é um autorrelato exploratório para conversas de desenvolvimento. Ele é inspirado
no modelo DISC, mas não é apresentado como instrumento oficial, certificado, diagnóstico ou validado
por terceiros.

## Perspectivas

- **Natural:** respostas N01 a N19 sobre tendências espontâneas relatadas.
- **Adaptado:** respostas A01 a A19 sobre atuação profissional relatada.
- Motivação (M01 a M07) e liderança (L01 a L05) continuam calculadas separadamente e não alteram os
  quatro fatores DISC.

## Mapeamento dos fatores

- **D — Dominância:** iniciativa, direcionamento, objetividade e posicionamento.
- **I — Influência:** influência, expressão, energia e interação.
- **S — Estabilidade:** consideração pelas pessoas, calma, continuidade, foco e autonomia.
- **C — Conformidade:** planejamento, organização, detalhes, cautela, decisão e exploração de
  divergências.

Todos os 19 itens de cada perspectiva participam exatamente de um fator.

## Cálculo determinístico

Para cada fator e perspectiva:

1. calcula-se a média aritmética das respostas de 1 a 5 dos itens associados;
2. converte-se a média para intensidade de 0 a 100 pela fórmula
   `round(((média - 1) / 4) * 100)`.

As escalas D, I, S e C são independentes e não precisam somar 100%. Empates são preservados.

- Variação total de até 10 pontos: perfil equilibrado entre os quatro fatores.
- Fatores a até 5 pontos do maior valor: predominâncias conjuntas.
- Demais fatores a até 15 pontos da menor predominância: fatores secundários.

Esses limiares são regras interpretativas versionadas do RISE e não normas populacionais.

## Versionamento e histórico

- Instrumento: `rise-behavioral-disc-2.0`
- Pontuação: `rise-disc-scoring-2.0`
- Prompt de interpretação: `rise-disc-insights-2.0`
- Contrato de saída da IA: `rise-ai-output-2.0`

Resultados concluídos de versões anteriores não são sobrescritos. Uma tentativa antiga ainda em
andamento pode ser retomada e, somente quando concluída, recebe o cálculo vigente. O JSON calculado e
as respostas que o fundamentam permanecem persistidos e auditáveis.

## Uso da OpenAI

A IA recebe apenas o resultado determinístico necessário para interpretação. Ela não calcula,
normaliza, corrige nem altera pontuações. A saída segue contrato JSON estruturado, é versionada por
prompt e persistida com idempotência por tentativa, público e versão.
