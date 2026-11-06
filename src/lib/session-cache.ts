import type { QueryClient } from "@tanstack/react-query";

// Cada cliente pertence à sua própria árvore React; não compartilha dados de sessão.
const owners = new WeakMap<QueryClient, string | null>();

/** Limpa dados privados antes de outra conta poder montar a interface. */
export function syncSessionCache(client: QueryClient, userId: string | null) {
  if (owners.has(client) && owners.get(client) === userId) return;
  client.clear();
  owners.set(client, userId);
}

export function isSessionCacheOwner(client: QueryClient, userId: string) {
  return owners.get(client) === userId;
}
