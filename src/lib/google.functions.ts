/* eslint-disable @typescript-eslint/no-explicit-any -- compatibility facade; Edge Function validates inputs */
import { createEdgeFunction } from "./edge-function-client";

export const googleStatus = createEdgeFunction<
  undefined,
  { connected: boolean; reconnectRequired: boolean; email: string | null }
>("googleStatus");
export const startGoogleConnect = createEdgeFunction<undefined, { authorizationUrl: string }>(
  "startGoogleConnect",
);
export const completeGoogleConnect: any = createEdgeFunction("completeGoogleConnect");
export const disconnectGoogle: any = createEdgeFunction("disconnectGoogle");
export const createMeeting: any = createEdgeFunction("createMeeting");
export const updateMeeting: any = createEdgeFunction("updateMeeting");
export const cancelMeeting: any = createEdgeFunction("cancelMeeting");
