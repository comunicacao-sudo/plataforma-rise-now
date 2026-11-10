export function readLocalVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const source = URL.createObjectURL(file);
    const finish = (duration: number | null) => {
      clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(source);
      resolve(duration);
    };
    const timer = setTimeout(() => finish(null), 12000);
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      finish(
        Number.isFinite(video.duration) && video.duration > 0 ? Math.round(video.duration) : null,
      );
    video.onerror = () => finish(null);
    video.src = source;
  });
}

/** Lê só os metadados de um vídeo já publicado (link temporário) para saber a duração. */
export function readRemoteVideoDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const finish = (duration: number | null) => {
      clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      resolve(duration);
    };
    const timer = setTimeout(() => finish(null), 20000);
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () =>
      finish(
        Number.isFinite(video.duration) && video.duration > 0 ? Math.round(video.duration) : null,
      );
    video.onerror = () => finish(null);
    video.src = url;
  });
}

export function videoDurationLabel(seconds: number | null | undefined, minutes?: number | null) {
  if (seconds && Number.isFinite(seconds)) {
    const total = Math.max(1, Math.round(seconds));
    return total >= 3600
      ? `${Math.floor(total / 3600)}h ${String(Math.floor((total % 3600) / 60)).padStart(2, "0")}min`
      : `${Math.max(1, Math.ceil(total / 60))} min`;
  }
  return minutes ? `${minutes} min` : "Duração ainda não detectada";
}
