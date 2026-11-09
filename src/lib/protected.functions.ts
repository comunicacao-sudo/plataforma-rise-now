import { createEdgeFunction } from "./edge-function-client";
import type { ProtectedScope } from "../../supabase/functions/_shared/protected-resources";
export const authorizeProtectedOperation = createEdgeFunction<
  {
    scope: ProtectedScope;
    email: string;
    password: string;
  },
  { proof: string }
>("authorizeProtectedOperation");
export const moveResourceToTrash = createEdgeFunction<
  {
    type: ProtectedScope["type"];
    id: string;
    proof: string;
  },
  { ok: boolean; googleWarning?: boolean }
>("moveResourceToTrash");
export const restoreTrashResource = createEdgeFunction<
  { id: string; proof: string },
  {
    ok: boolean;
    message: string;
  }
>("restoreTrashResource");
export type TrashItem = {
  id: string;
  type: ProtectedScope["type"];
  resourceId: string;
  label: string;
  deletedAt: string;
  expiresAt: string;
  purgePending: boolean;
  deletedBy: string;
  canRestore: boolean;
};
export const listTrash = createEdgeFunction<
  { offset?: number },
  { items: TrashItem[]; total: number }
>("listTrash");
