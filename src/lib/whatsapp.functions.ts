/* eslint-disable @typescript-eslint/no-explicit-any -- compatibility facade; Edge Function validates inputs */
import { createEdgeFunction } from "./edge-function-client";

export const getWhatsAppAdminState: any = createEdgeFunction("getWhatsAppAdminState");
export const saveWhatsAppSettings: any = createEdgeFunction("saveWhatsAppSettings");
export const startWhatsAppSession: any = createEdgeFunction("startWhatsAppSession");
export const restartWhatsAppSession: any = createEdgeFunction("restartWhatsAppSession");
export const disconnectWhatsAppSession: any = createEdgeFunction("disconnectWhatsAppSession");
export const getWhatsAppQrCode: any = createEdgeFunction("getWhatsAppQrCode");
export const sendWhatsAppTest: any = createEdgeFunction("sendWhatsAppTest");
