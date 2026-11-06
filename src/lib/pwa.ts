import { createContext, useContext } from "react";

export interface InstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallDevice = "ios" | "android" | "mac" | "desktop";

export function installDevice(userAgent: string, touchPoints = 0): InstallDevice {
  if (/iPad|iPhone|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && touchPoints > 1))
    return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return /Macintosh|Mac OS X/i.test(userAgent) ? "mac" : "desktop";
}

export const PwaContext = createContext({
  standalone: true,
  prompt: null as InstallPromptEvent | null,
  clearPrompt: () => {},
});

export function usePwa() {
  return useContext(PwaContext);
}
