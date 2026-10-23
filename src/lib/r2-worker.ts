import { supabase } from "@/integrations/supabase/client";

export const R2_WORKER_BASE = "https://rise-now-r2.rise-now-pamaris.workers.dev";

type StartUploadResponse = {
  key: string;
  mediaPath: string;
  uploadId: string;
  partSize: number;
};

type UploadedPart = {
  partNumber: number;
  etag: string;
};

async function accessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Sua sessão expirou. Entre novamente na plataforma.");
  return token;
}

async function workerFetch(path: string, init: RequestInit = {}) {
  const token = await accessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${R2_WORKER_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : `Cloudflare respondeu com HTTP ${response.status}.`;
    throw new Error(message);
  }

  return response;
}

async function workerJson<T>(path: string, body: unknown): Promise<T> {
  const response = await workerFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

export async function uploadLessonToR2(
  file: File,
  onProgress?: (uploadedBytes: number, totalBytes: number) => void,
) {
  const contentType = file.type || "video/mp4";
  const started = await workerJson<StartUploadResponse>("/upload/start", {
    fileName: file.name,
    contentType,
    size: file.size,
  });

  const partCount = Math.ceil(file.size / started.partSize);
  const parts: UploadedPart[] = [];
  onProgress?.(0, file.size);

  try {
    for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
      const start = (partNumber - 1) * started.partSize;
      const end = Math.min(start + started.partSize, file.size);
      const chunk = file.slice(start, end);

      const query = new URLSearchParams({
        key: started.key,
        uploadId: started.uploadId,
        partNumber: String(partNumber),
      });
      const response = await workerFetch(`/upload/part?${query.toString()}`, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: chunk,
      });
      const part = (await response.json()) as UploadedPart;
      parts.push(part);
      onProgress?.(end, file.size);
    }

    const completed = await workerJson<{ ok: boolean; mediaPath: string }>("/upload/complete", {
      key: started.key,
      uploadId: started.uploadId,
      parts,
    });
    onProgress?.(file.size, file.size);
    return completed.mediaPath || started.mediaPath;
  } catch (error) {
    await workerJson("/upload/abort", {
      key: started.key,
      uploadId: started.uploadId,
    }).catch(() => undefined);
    throw error;
  }
}

export async function getR2PlaybackUrl(stepKey: string) {
  const result = await workerJson<{ url: string; expiresAt: string }>("/ticket", { stepKey });
  return result;
}

export async function deleteLessonFromR2(mediaPath: string) {
  if (!mediaPath.startsWith("r2:")) return;
  await workerJson<{ ok: boolean }>("/object/delete", { mediaPath });
}
