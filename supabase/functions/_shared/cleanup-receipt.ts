import { proofHash } from "./protected-resources.ts";
export async function readCleanupReceipt(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Recibo inválido.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.length;
    if (size > 4096) {
      await reader.cancel();
      throw new Error("Recibo inválido.");
    }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const input = JSON.parse(new TextDecoder().decode(bytes)) as { jobId?: unknown; token?: unknown };
  if (
    typeof input.jobId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.jobId) ||
    typeof input.token !== "string"
  )
    throw new Error("Recibo inválido.");
  return { jobId: input.jobId, tokenHash: await proofHash(input.token) };
}
