import type { QueryClient } from "@tanstack/react-query";
export async function invalidateTrashData(qc: QueryClient) {
  await qc.invalidateQueries({
    predicate: (query) =>
      /directory|stage|journey|cohort|meeting|agenda|booking|automation|material|rise90|trash/i.test(
        String(query.queryKey[0]),
      ),
  });
}
