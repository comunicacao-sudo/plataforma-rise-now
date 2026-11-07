import { googleCalendarClient } from "./google-calendar.ts";

export const googleDriveScope = "https://www.googleapis.com/auth/drive.readonly";
export function hasDriveScope(tokens: { scope?: string } | null) {
  return String(tokens?.scope ?? "")
    .split(/\s+/)
    .includes(googleDriveScope);
}

/** O dono do token só pode servir a revisão exata que autorizou explicitamente. */
export async function authorizedDriveAccess(db: any, contentId: string, revision: number) {
  const { data: owner, error } = await db.rpc("resolve_drive_video_authorizer", {
    p_content_id: contentId,
    p_revision: revision,
  });
  if (error) throw new Error("Não foi possível verificar a autorização do Drive.");
  if (!owner) return null;
  const drive = googleCalendarClient(db, "google_drive");
  if (!hasDriveScope(await drive.googleTokens(owner)))
    throw new Error("A mentora responsável precisa reconectar o Google Drive em Conteúdos.");
  const token = await drive.googleAccess(owner);
  if (!token)
    throw new Error("A mentora responsável precisa reconectar o Google Drive em Conteúdos.");
  return token as string;
}
