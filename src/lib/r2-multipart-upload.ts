const RETRY_DELAYS = [0, 1_500, 3_000, 6_000, 10_000];
const SIGNED_URL_BATCH_SIZE = 25;

type MultipartSession = {
  path: string;
  key: string;
  uploadId: string;
  partSize: number;
};

type PartUrl = {
  partNumber: number;
  url: string;
};

type UploadOptions = {
  file: File;
  createUpload: (args: {
    data: { fileName: string; contentType: string; size: number };
  }) => Promise<MultipartSession>;
  getPartUrls: (args: {
    data: { key: string; uploadId: string; partNumbers: number[] };
  }) => Promise<{ parts: PartUrl[] }>;
  completeUpload: (args: {
    data: {
      key: string;
      uploadId: string;
      parts: Array<{ partNumber: number; etag: string }>;
    };
  }) => Promise<{ ok: boolean; path: string }>;
  abortUpload: (args: {
    data: { key: string; uploadId: string };
  }) => Promise<{ ok: boolean }>;
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function uploadPart(
  url: string,
  blob: Blob,
  baseOffset: number,
  totalBytes: number,
  onProgress?: (uploadedBytes: number, totalBytes: number) => void,
) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      onProgress?.(Math.min(totalBytes, baseOffset + event.loaded), totalBytes);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag");
        if (!etag) {
          reject(
            new Error(
              "O Cloudflare recebeu uma parte do vídeo, mas não expôs o ETag. Verifique o CORS do bucket.",
            ),
          );
          return;
        }
        resolve(etag);
        return;
      }

      reject(
        new Error(
          xhr.responseText ||
            `Falha no envio de uma parte do vídeo para o Cloudflare (HTTP ${xhr.status}).`,
        ),
      );
    };

    xhr.onerror = () => reject(new Error("A conexão caiu durante o envio para o Cloudflare."));
    xhr.send(blob);
  });
}

async function uploadPartWithRetry(
  url: string,
  blob: Blob,
  baseOffset: number,
  totalBytes: number,
  onProgress?: (uploadedBytes: number, totalBytes: number) => void,
) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt += 1) {
    if (RETRY_DELAYS[attempt]) await sleep(RETRY_DELAYS[attempt]);
    try {
      return await uploadPart(url, blob, baseOffset, totalBytes, onProgress);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Não foi possível enviar uma parte do vídeo para o Cloudflare.");
}

export async function uploadR2Multipart(options: UploadOptions) {
  const contentType = options.file.type || "application/octet-stream";
  const session = await options.createUpload({
    data: {
      fileName: options.file.name,
      contentType,
      size: options.file.size,
    },
  });

  const partCount = Math.ceil(options.file.size / session.partSize);
  const completedParts: Array<{ partNumber: number; etag: string }> = [];
  options.onProgress?.(0, options.file.size);

  try {
    for (let first = 1; first <= partCount; first += SIGNED_URL_BATCH_SIZE) {
      const partNumbers = Array.from(
        { length: Math.min(SIGNED_URL_BATCH_SIZE, partCount - first + 1) },
        (_, index) => first + index,
      );

      const signed = await options.getPartUrls({
        data: {
          key: session.key,
          uploadId: session.uploadId,
          partNumbers,
        },
      });
      const urlByPart = new Map(signed.parts.map((part) => [part.partNumber, part.url]));

      for (const partNumber of partNumbers) {
        const url = urlByPart.get(partNumber);
        if (!url) throw new Error(`URL de upload ausente para a parte ${partNumber}.`);

        const start = (partNumber - 1) * session.partSize;
        const end = Math.min(start + session.partSize, options.file.size);
        const etag = await uploadPartWithRetry(
          url,
          options.file.slice(start, end),
          start,
          options.file.size,
          options.onProgress,
        );

        completedParts.push({ partNumber, etag });
        options.onProgress?.(end, options.file.size);
      }
    }

    const completed = await options.completeUpload({
      data: {
        key: session.key,
        uploadId: session.uploadId,
        parts: completedParts,
      },
    });
    options.onProgress?.(options.file.size, options.file.size);
    return completed.path || session.path;
  } catch (error) {
    try {
      await options.abortUpload({
        data: {
          key: session.key,
          uploadId: session.uploadId,
        },
      });
    } catch {
      // Cloudflare automatically clears stale multipart uploads later as a fallback.
    }
    throw error;
  }
}
