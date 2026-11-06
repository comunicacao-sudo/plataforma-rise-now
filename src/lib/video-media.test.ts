import assert from "node:assert/strict";
import test from "node:test";
import {
  createMediaTicket,
  driveFileId,
  mediaRequestRange,
  mediaSessionId,
  readDriveVideo,
  validRange,
  validVideoDuration,
  verifyMediaTicket,
  type MediaTicket,
} from "../../supabase/functions/_shared/video-media.ts";
import { videoDurationLabel } from "./video-duration";

const id = "1234567890abcdefghij";
const source = `https://drive.google.com/file/d/${id}/view`;
const now = Date.parse("2026-11-06T20:00:00Z");
const ticket: MediaTicket = {
  userId: "00000000-0000-4000-8000-000000000001",
  contentId: "00000000-0000-4000-8000-000000000002",
  sessionId: "00000000-0000-4000-8000-000000000003",
  revision: 1,
  expiresAt: now + 3600_000,
};

test("identifica arquivos do Drive somente nos hosts e caminhos permitidos", () => {
  assert.equal(driveFileId(source), id);
  assert.equal(driveFileId(`https://drive.google.com/open?id=${id}`), id);
  for (const invalid of [
    `https://evil.invalid/file/d/${id}`,
    `https://drive.google.com.evil.invalid/file/d/${id}`,
    `javascript:alert(1)`,
    `http://drive.google.com/file/d/${id}`,
    "https://drive.google.com/drive/folders/pasta",
  ])
    assert.equal(driveFileId(invalid), null);
});
test("duração rejeita valores desconhecidos, negativos e acima de um dia", () => {
  for (const invalid of [null, undefined, NaN, Infinity, 0, -1, 86401])
    assert.equal(validVideoDuration(invalid), null);
  assert.equal(validVideoDuration(3599.6), 3600);
  assert.equal(videoDurationLabel(3601), "1h 00min");
  assert.equal(videoDurationLabel(null, 90), "90 min");
});
test("ticket autentica usuário, conteúdo, sessão e versão sem carregar o link do Drive", async () => {
  const signed = await createMediaTicket(ticket, "segredo-apenas-do-teste");
  assert.deepEqual(await verifyMediaTicket(signed, "segredo-apenas-do-teste", now), ticket);
  assert.equal(signed.includes(id), false);
  await assert.rejects(verifyMediaTicket(signed, "outro-ambiente", now));
});
test("ticket adulterado ou vencido não é aceito", async () => {
  const signed = await createMediaTicket(ticket, "teste");
  const parts = signed.split(".");
  const altered = Buffer.from(
    JSON.stringify({ ...ticket, userId: "00000000-0000-4000-8000-000000000099" }),
  ).toString("base64url");
  await assert.rejects(verifyMediaTicket(`${altered}.${parts[1]}`, "teste", now));
  await assert.rejects(verifyMediaTicket(signed, "teste", now + 3600_001));
  await assert.rejects(verifyMediaTicket("sem-assinatura", "teste", now));
});
test("ticket sem sessão válida ou com validade excessiva é recusado", async () => {
  for (const value of [
    { ...ticket, sessionId: "sem-sessao" },
    { ...ticket, expiresAt: now + 8 * 3600_000 },
  ]) {
    const signed = await createMediaTicket(value, "teste");
    await assert.rejects(verifyMediaTicket(signed, "teste", now));
  }
});
test("sessão do ticket vem do token já verificado pelo Auth", () => {
  const payload = Buffer.from(JSON.stringify({ session_id: ticket.sessionId })).toString(
    "base64url",
  );
  assert.equal(mediaSessionId(`Bearer cabecalho.${payload}.assinatura`), ticket.sessionId);
  assert.throws(() => mediaSessionId("Bearer invalido"));
});
test("requisições de vídeo rejeitam Range múltiplo e limitações inválidas", () => {
  for (const range of [null, "bytes=0-1", "bytes=100-", "bytes=-100"])
    assert.equal(validRange(range), true);
  for (const range of [
    "bytes=0-1,2-3",
    "bytes=-0",
    "bytes=100-1",
    "bytes=999999999999999999999-",
    "items=0-1",
    "bytes=a-b",
  ])
    assert.equal(validRange(range), false);
  assert.equal(mediaRequestRange("bytes=0-"), "bytes=0-8388607");
  assert.equal(mediaRequestRange("bytes=100-200"), "bytes=100-200");
  assert.equal(mediaRequestRange("bytes=-9999999"), "bytes=-8388608");
});
test("consulta metadados e duração do Drive sem devolver a chave ao player", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "www.googleapis.com");
    assert.equal(url.searchParams.get("key"), "chave-so-do-teste");
    assert.equal(
      new Headers(init?.headers).get("Referer"),
      "https://board.mentoriarisenow.com.br/",
    );
    calls++;
    return Response.json({
      mimeType: "video/mp4",
      videoMediaMetadata: { durationMillis: "5400000" },
      capabilities: { canDownload: true },
    });
  };
  const data = await readDriveVideo(
    source,
    "chave-so-do-teste",
    "https://board.mentoriarisenow.com.br",
    fetcher,
  );
  assert.equal(calls, 1);
  assert.deepEqual(data, { durationSeconds: 5400, mimeType: "video/mp4" });
  assert.equal(JSON.stringify(data).includes("chave-so-do-teste"), false);
});
test("configuração ausente e arquivo inacessível falham sem simular duração", async () => {
  await assert.rejects(readDriveVideo(source, null, "https://example.invalid"), /configurada/);
  await assert.rejects(
    readDriveVideo(
      source,
      "teste",
      "https://example.invalid",
      async () => new Response(null, { status: 403 }),
    ),
    /não liberou/,
  );
  await assert.rejects(
    readDriveVideo(source, "teste", "https://example.invalid", async () =>
      Response.json({ mimeType: "application/pdf" }),
    ),
    /não é um vídeo/,
  );
  await assert.rejects(
    readDriveVideo(source, "teste", "https://example.invalid", async () =>
      Response.json({ mimeType: "video/mp4", capabilities: { canDownload: false } }),
    ),
    /não permite/,
  );
});
