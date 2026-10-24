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

export type CalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  source: "google" | "rise";
  kind: "google" | "collective" | "individual";
  joinUrl: string | null;
};

export type BookingOffering = {
  id: string;
  title: string;
  description: string | null;
  mentorId: string;
  mentorName: string;
  durationMinutes: number;
  bufferMinutes: number;
  cancellationNoticeHours: number;
  status: "active" | "paused" | "archived";
  cohortIds: string[];
  rules: Array<{
    id: string;
    weekday: number;
    startTime: string;
    endTime: string;
    validFrom: string;
    validUntil: string | null;
  }>;
};

export const getCalendarOverview = createEdgeFunction<
  { startsAt: string; endsAt: string },
  { events: CalendarEvent[]; googleConnected: boolean; reconnectRequired: boolean }
>("getCalendarOverview");
export const listBookingOfferings = createEdgeFunction<
  undefined,
  { offerings: BookingOffering[]; staff: boolean }
>("listBookingOfferings");
export const createBookingOffering: any = createEdgeFunction("createBookingOffering");
export const updateBookingOffering: any = createEdgeFunction("updateBookingOffering");
export const getAvailableBookingSlots = createEdgeFunction<
  { offeringId: string; startsAt: string; endsAt: string },
  { slots: Array<{ startsAt: string; endsAt: string }>; googleConnected: boolean }
>("getAvailableBookingSlots");
export const bookOneToOne: any = createEdgeFunction("bookOneToOne");
export const cancelOneToOne: any = createEdgeFunction("cancelOneToOne");
export const listMyBookings = createEdgeFunction<
  undefined,
  {
    bookings: Array<{
      id: string;
      title: string;
      mentorName: string;
      startsAt: string;
      endsAt: string;
      cancellationNoticeHours: number;
    }>;
  }
>("listMyBookings");
