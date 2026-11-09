/** Integração do Worker R2: chamada antes das rotas normais e da autenticação de usuário. */
export async function handleR2TrashRoute(
  request: Request,
  bucket: { delete: (key: string) => Promise<unknown> },
  fetcher: typeof fetch = fetch,
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path === "/object/delete")
    return Response.json(
      { error: "Use a lixeira da RISE. Arquivos são removidos após 30 dias." },
      { status: 409 },
    );
  if (path !== "/trash/purge") return null;
  if (request.method !== "POST") return new Response(null, { status: 405 });
  try {
    const reader = request.body?.getReader();
    if (!reader) return new Response(null, { status: 400 });
    const parts: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 4096) {
        await reader.cancel();
        return new Response(null, { status: 413 });
      }
      parts.push(chunk.value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      body.set(part, offset);
      offset += part.length;
    }
    const input = JSON.parse(new TextDecoder().decode(body)) as {
      jobId?: unknown;
      token?: unknown;
    };
    if (
      typeof input.jobId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(input.jobId) ||
      typeof input.token !== "string" ||
      !/^[a-f0-9]{64}$/.test(input.token)
    )
      return new Response(null, { status: 400 });
    // O servidor devolve a chave autorizada; o cliente não escolhe qual objeto apagar.
    const authorization = await fetcher(
      "https://riakceytqrlvdcgcwfdx.supabase.co/functions/v1/rise-media/cleanup-receipt",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: input.jobId, token: input.token }),
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!authorization.ok)
      return new Response(null, { status: authorization.status === 403 ? 403 : 503 });
    const result = (await authorization.json()) as { key?: unknown };
    if (typeof result.key !== "string" || !result.key || result.key.length > 2048)
      return new Response(null, { status: 403 });
    await bucket.delete(result.key);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return new Response(null, { status: 503 });
  }
}
