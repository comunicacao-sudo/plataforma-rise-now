import { lazy, Suspense, type ReactNode } from "react";

/** Cada área baixa seu código quando é aberta; mantém o restante da tela visível. */
export function deferredView<P extends object>(
  load: () => Promise<{ default: (props: P) => ReactNode }>,
) {
  const View = lazy(load);
  return function DeferredView(props: P) {
    return (
      <Suspense
        fallback={
          <div className="ops-empty" role="status" aria-live="polite">
            Carregando esta área…
          </div>
        }
      >
        <View {...props} />
      </Suspense>
    );
  };
}
