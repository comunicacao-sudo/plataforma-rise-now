/** Serializa também entre desmontagens/remontagens rápidas do mesmo caderno. */
const queues = new Map<string, Promise<unknown>>();
export function queueNoteSave<T>(key: string, save: () => Promise<T>): Promise<T> {
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(save);
  queues.set(key, next);
  void next
    .finally(() => {
      if (queues.get(key) === next) queues.delete(key);
    })
    .catch(() => {});
  return next;
}
