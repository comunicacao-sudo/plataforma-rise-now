import { supabase } from "@/integrations/supabase/client";

type EdgeOptions<T> = T extends undefined ? { data?: undefined } | undefined : { data: T };
type EdgeFunction<TInput, TOutput> = (options?: EdgeOptions<TInput>) => Promise<TOutput>;

/** Calls the authenticated RISE backend hosted by Supabase Edge Functions. */
// The public facades intentionally keep their historical loose call signature;
// validation is authoritative inside the Edge Function.
export function createEdgeFunction<TInput = unknown, TOutput = unknown>(
  action: string,
): EdgeFunction<TInput, TOutput> {
  return async (options?: EdgeOptions<TInput>) => {
    const input =
      options && typeof options === "object" && "data" in options ? options.data : undefined;
    const { data, error } = await supabase.functions.invoke("rise-backend", {
      body: { action, data: input },
    });
    if (error) {
      let message = error.message;
      const context = (error as { context?: Response }).context;
      if (context) {
        const payload = (await context
          .clone()
          .json()
          .catch(() => null)) as { error?: unknown } | null;
        if (typeof payload?.error === "string") message = payload.error;
      }
      throw new Error(message);
    }
    if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
      throw new Error(data.error);
    }
    return data as TOutput;
  };
}
