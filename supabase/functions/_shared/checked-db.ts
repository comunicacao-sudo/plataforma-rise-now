/** Faz consultas internas falharem de forma explícita, inclusive as que retornam { error }. */
export function checkedDb<T>(client: T): T {
  const wrap = (value: any): any => {
    if (!value || typeof value !== "object") return value;
    return new Proxy(value, {
      get(target, key) {
        if (key === "then" && typeof target.then === "function")
          return (resolve: any, reject: any) =>
            Promise.resolve(target)
              .then((result: any) => {
                if (result?.error)
                  throw new Error(result.error.message ?? "Falha no banco de dados.");
                return result;
              })
              .then(resolve, reject);
        const member = Reflect.get(target, key);
        return typeof member === "function"
          ? (...args: any[]) => wrap(member.apply(target, args))
          : member;
      },
    });
  };
  return wrap(client);
}
