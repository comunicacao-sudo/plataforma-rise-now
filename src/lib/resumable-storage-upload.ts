const TUS_VERSION = "1.0.0";
const CHUNK_SIZE = 6 * 1024 * 1024;
const RETRY_DELAYS = [0, 3_000, 5_000, 10_000, 20_000];

type ResumableUploadOptions = {
  bucketName: string;
  objectPath: string;
  file: File;
  token: string;
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
  signal?: AbortSignal;
};

function directStorageEndpoint() {
  const configured = import.meta.env["VITE_SUPABASE_URL"];
  if (!configured) throw new Error("URL do Supabase não configurada.");

  const url = new URL(configured);
  const match = url.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
  if (match) {
    return `https://${match[1]}.storage.supabase.co/storage/v1/upload/resumable`;
  }

  return `${url.origin}/storage/v1/upload/resumable`;
}

function base64Metadata(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function uploadMetadata(options: ResumableUploadOptions) {
  return [
    ["bucketName", options.bucketName],
    ["objectName", options.objectPath],
    ["contentType", options.file.type || "application/octet-stream"],
    ["cacheControl", "3600"],
  ]
    .map(([key, value]) => `${key} ${base64Metadata(value)}`)
    .join(",");
}

function abortError() {
  return new DOMException("Upload cancelado.", "AbortError");
}

async function sleep(ms: number, signal?: AbortSignal) {
  if (!ms) return;
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    let timer = 0;
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(abortError());
    };

    timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function createUpload(options: ResumableUploadOptions) {
  if (options.signal?.aborted) throw abortError();

  const response = await fetch(directStorageEndpoint(), {
    method: "POST",
    headers: {
      "Tus-Resumable": TUS_VERSION,
      "Upload-Length": String(options.file.size),
      "Upload-Metadata": uploadMetadata(options),
      "x-signature": options.token,
    },
    signal: options.signal ?? null,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      detail || `Não foi possível iniciar o upload do vídeo (HTTP ${response.status}).`,
    );
  }

  const location = response.headers.get("Location");
  if (!location) throw new Error("O Supabase não retornou a URL resumível do upload.");

  return new URL(location, directStorageEndpoint()).toString();
}

async function getServerOffset(uploadUrl: string, token: string, signal?: AbortSignal) {
  const response = await fetch(uploadUrl, {
    method: "HEAD",
    headers: {
      "Tus-Resumable": TUS_VERSION,
      "x-signature": token,
    },
    signal: signal ?? null,
  });

  if (!response.ok) throw new Error("Não foi possível consultar o ponto de retomada do upload.");

  const offset = Number(response.headers.get("Upload-Offset"));
  if (!Number.isFinite(offset) || offset < 0) {
    throw new Error("O Supabase retornou um ponto de retomada inválido.");
  }
  return offset;
}

function patchChunk(
  uploadUrl: string,
  token: string,
  chunk: Blob,
  offset: number,
  totalBytes: number,
  onProgress?: (uploadedBytes: number, totalBytes: number) => void,
  signal?: AbortSignal,
) {
  return new Promise<number>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("PATCH", uploadUrl, true);
    xhr.setRequestHeader("Tus-Resumable", TUS_VERSION);
    xhr.setRequestHeader("Upload-Offset", String(offset));
    xhr.setRequestHeader("Content-Type", "application/offset+octet-stream");
    xhr.setRequestHeader("x-signature", token);

    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort, { once: true });

    const cleanup = () => signal?.removeEventListener("abort", onAbort);

    xhr.upload.onprogress = (event) => {
      onProgress?.(Math.min(totalBytes, offset + event.loaded), totalBytes);
    };

    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        const headerOffset = Number(xhr.getResponseHeader("Upload-Offset"));
        resolve(
          Number.isFinite(headerOffset) && headerOffset > offset
            ? headerOffset
            : offset + chunk.size,
        );
        return;
      }

      reject(
        new Error(
          xhr.responseText ||
            `Falha ao enviar uma parte do vídeo (HTTP ${xhr.status || "desconhecido"}).`,
        ),
      );
    };

    xhr.onerror = () => {
      cleanup();
      reject(new Error("A conexão caiu durante o upload do vídeo."));
    };

    xhr.onabort = () => {
      cleanup();
      reject(abortError());
    };

    xhr.send(chunk);
  });
}

export async function uploadSignedResumable(options: ResumableUploadOptions) {
  const uploadUrl = await createUpload(options);
  let offset = 0;
  options.onProgress?.(0, options.file.size);

  while (offset < options.file.size) {
    if (options.signal?.aborted) throw abortError();

    let completedChunk = false;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < RETRY_DELAYS.length && !completedChunk; attempt += 1) {
      const delay = RETRY_DELAYS[attempt] ?? 0;
      if (delay) {
        await sleep(delay, options.signal);
      }

      const end = Math.min(offset + CHUNK_SIZE, options.file.size);
      const chunk = options.file.slice(offset, end);

      try {
        const nextOffset = await patchChunk(
          uploadUrl,
          options.token,
          chunk,
          offset,
          options.file.size,
          options.onProgress,
          options.signal,
        );
        offset = Math.min(options.file.size, nextOffset);
        options.onProgress?.(offset, options.file.size);
        completedChunk = true;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        lastError = error;

        try {
          const serverOffset = await getServerOffset(uploadUrl, options.token, options.signal);
          if (serverOffset > offset) {
            offset = Math.min(options.file.size, serverOffset);
            options.onProgress?.(offset, options.file.size);
            completedChunk = true;
          }
        } catch {
          // Retry with the same offset. The original upload error is more useful to the user.
        }
      }
    }

    if (!completedChunk) {
      throw lastError instanceof Error
        ? lastError
        : new Error("Não foi possível concluir o upload do vídeo.");
    }
  }

  options.onProgress?.(options.file.size, options.file.size);
}
