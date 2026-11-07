import assert from "node:assert/strict";
import test from "node:test";
import {
  createMediaTicket,
  driveFailure,
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
import {
  authorizedDriveAccess,
  googleDriveScope,
  hasDriveScope,
} from "../../supabase/functions/_shared/google-drive.ts";
import { oauthConnector } from "./google-oauth";

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

test("Drive privado usa OAuth somente no servidor e não põe token ou chave no endereço", async () => {
  const metadata = await readDriveVideo(
    source,
    "chave-que-nao-deve-ser-usada",
    "https://board.mentoriarisenow.com.br",
    async (url, init) => {
      assert.equal(new URL(String(url)).searchParams.has("key"), false);
      assert.equal(String(url).includes("token-servidor"), false);
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer token-servidor");
      return Response.json({
        mimeType: "video/mp4",
        videoMediaMetadata: { durationMillis: "900000" },
        capabilities: { canDownload: true },
      });
    },
    "token-servidor",
  );
  assert.equal(metadata.durationSeconds, 900);
  assert.deepEqual(Object.keys(metadata).sort(), ["durationSeconds", "mimeType"]);
});

test("OAuth não contorna proibição de download nem disfarça recusa do provedor", async () => {
  await assert.rejects(
    readDriveVideo(
      source,
      null,
      "https://example.invalid",
      async () => Response.json({ mimeType: "video/mp4", capabilities: { canDownload: false } }),
      "token-servidor",
    ),
    /não permite/,
  );
  await assert.rejects(
    readDriveVideo(
      source,
      null,
      "https://example.invalid",
      async () => new Response(null, { status: 403 }),
      "token-servidor",
    ),
    /não liberou/,
  );
});

test("API desativada identifica o projeto OAuth sem confundir com a chave nem expor a resposta original", async () => {
  const response = () =>
    Response.json(
      {
        error: {
          message: "chave-ou-token-que-nao-pode-ser-exposto",
          details: [
            { reason: "SERVICE_DISABLED", metadata: { consumer: "projects/123456789012" } },
          ],
        },
      },
      { status: 403 },
    );
  const oauthError = await driveFailure(response(), "oauth");
  assert.match(oauthError.message, /projeto da conexão Google.*123456789012/);
  assert.doesNotMatch(oauthError.message, /chave-ou-token-que-nao-pode-ser-exposto/);
  const keyError = await driveFailure(response());
  assert.match(keyError.message, /chave foi criada.*123456789012/);
  const invalid = await driveFailure(
    Response.json(
      {
        error: {
          details: [
            {
              reason: "SERVICE_DISABLED",
              metadata: { consumer: "https://example.invalid/segredo" },
            },
          ],
        },
      },
      { status: 403 },
    ),
    "oauth",
  );
  assert.doesNotMatch(invalid.message, /example|segredo/);
});

test("sem vínculo da revisão exata o servidor não consulta credenciais de outra mentora", async () => {
  const db = {
    async rpc(name: string, args: unknown) {
      assert.equal(name, "resolve_drive_video_authorizer");
      assert.deepEqual(args, { p_content_id: ticket.contentId, p_revision: 2 });
      return { data: null, error: null };
    },
    from() {
      assert.fail("Não pode procurar um token global quando não há autorização.");
    },
  };
  assert.equal(await authorizedDriveAccess(db, ticket.contentId, 2), null);
  await assert.rejects(
    authorizedDriveAccess(
      {
        rpc: async () => ({ data: null, error: { message: "interno" } }),
      },
      ticket.contentId,
      2,
    ),
    /verificar a autorização/,
  );
});

test("Drive exige o escopo de leitura e separa a janela OAuth da Agenda", () => {
  assert.equal(hasDriveScope({ scope: googleDriveScope }), true);
  assert.equal(
    hasDriveScope({ scope: "openid email https://www.googleapis.com/auth/calendar.events" }),
    false,
  );
  assert.equal(hasDriveScope(null), false);
  const state =
    btoa(JSON.stringify({ connectorId: "google_drive" })).replaceAll("=", "") + ".assinatura";
  assert.equal(oauthConnector(state), "google_drive");
  assert.equal(oauthConnector("invalido"), "google_calendar");
});

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
test("erros do Google informam a configuração necessária sem expor detalhes sensíveis", async () => {
  const cases = [
    ["API_KEY_INVALID", "drive_key_invalid"],
    ["SERVICE_DISABLED", "drive_api_disabled"],
    ["API_KEY_SERVICE_BLOCKED", "drive_api_restricted"],
    ["API_KEY_HTTP_REFERRER_BLOCKED", "drive_application_restricted"],
    ["API_KEY_IP_ADDRESS_BLOCKED", "drive_application_restricted"],
    ["downloadQuotaExceeded", "drive_quota"],
    ["insufficientFilePermissions", "drive_file_access"],
  ];
  for (const [reason, expected] of cases) {
    const error = await driveFailure(
      Response.json(
        { error: { message: "dado-privado-do-provedor", details: [{ reason }] } },
        { status: 403 },
      ),
    );
    assert.equal(error.code, expected);
    assert.equal(error.message.includes("dado-privado-do-provedor"), false);
  }
  assert.equal(
    (await driveFailure(new Response("não é JSON", { status: 502 }))).code,
    "drive_unavailable",
  );
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
