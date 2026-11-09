import { useLayoutEffect } from "react";
import { appUpdateGuards } from "@/lib/app-update";

export function useAppUpdateGuard(safe: boolean) {
  useLayoutEffect(() => appUpdateGuards.register(() => safe), [safe]);
}
