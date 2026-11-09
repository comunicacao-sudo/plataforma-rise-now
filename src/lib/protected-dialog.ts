import type { ProtectedScope } from "../../supabase/functions/_shared/protected-resources";
export type ProtectedDialogRequest = {
  scope: ProtectedScope;
  title: string;
  description: string;
  confirmLabel?: string;
  accept: () => void;
  resolve: (proof: string | null) => void;
};
export const protectedDialogEvent = "rise-protected-operation";
export function confirmProtectedOperation(
  input: Omit<ProtectedDialogRequest, "accept" | "resolve">,
): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let accepted = false;
    window.dispatchEvent(
      new CustomEvent<ProtectedDialogRequest>(protectedDialogEvent, {
        detail: {
          ...input,
          resolve,
          accept: () => {
            accepted = true;
          },
        },
      }),
    );
    if (!accepted) resolve(null);
  });
}
