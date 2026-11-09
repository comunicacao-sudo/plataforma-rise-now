export const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000;
export const UPDATE_FOCUS_INTERVAL = 30 * 1000;
export const UPDATE_REMINDER_INTERVAL = 30 * 60 * 1000;

export function appVersionUrl(now = Date.now()) {
  // O host pode não repassar _headers; uma URL nova também evita cache intermediário.
  return "/app-version.json?check=" + now.toString(36);
}

/** Nenhum dado da sessão faz parte do arquivo público de versão. */
export function readAppVersion(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("version" in value)) return null;
  return typeof value.version === "string" && /^[a-f0-9]{64}$/.test(value.version)
    ? value.version
    : null;
}

export function createVersionChecker({
  currentVersion,
  fetchVersion,
  onVersion,
  canCheck,
  now = Date.now,
}: {
  currentVersion: string;
  fetchVersion: (signal: AbortSignal) => Promise<unknown>;
  onVersion: (version: string | null) => void;
  canCheck: () => boolean;
  now?: () => number;
}) {
  let stopped = false;
  let checking = false;
  let lastCheck: number | null = null;
  let controller: AbortController | null = null;
  return {
    async check() {
      if (
        stopped ||
        checking ||
        !canCheck() ||
        (lastCheck !== null && now() - lastCheck < UPDATE_FOCUS_INTERVAL)
      )
        return;
      checking = true;
      controller = new AbortController();
      const request = controller;
      const timeout = setTimeout(() => request.abort(), 15000);
      try {
        const version = readAppVersion(await fetchVersion(request.signal));
        if (!version || stopped || request.signal.aborted) return;
        lastCheck = now();
        onVersion(version === currentVersion ? null : version);
      } catch {
        // Sem conexão ou publicação em andamento: mantém a tela e tenta depois.
      } finally {
        clearTimeout(timeout);
        checking = false;
      }
    },
    stop() {
      stopped = true;
      controller?.abort();
    },
  };
}

export function createUpdateGuards() {
  const guards = new Set<() => boolean>();
  return {
    register(isSafe: () => boolean) {
      guards.add(isSafe);
      return () => {
        guards.delete(isSafe);
      };
    },
    runIfSafe(action: () => boolean) {
      try {
        if ([...guards].some((isSafe) => !isSafe())) return false;
        // Verificação e recarga no mesmo trecho síncrono: nenhum envio começa entre elas.
        return action();
      } catch {
        return false;
      }
    },
  };
}

export const appUpdateGuards = createUpdateGuards();

/** Proteção conservadora: formulários devem estar salvos e fechados antes da recarga. */
export function canReloadApp(document: Document, online: boolean) {
  if (!online) return false;
  if (
    Array.from(document.querySelectorAll<HTMLMediaElement>("video, audio")).some(
      (media) => !media.paused && !media.ended,
    )
  )
    return false;
  const editors = document.querySelectorAll<HTMLElement>(
    [
      "form",
      ".ops-form",
      ".ops-inline-form",
      ".questionnaire-editor",
      ".journey-editor-modal",
      ".assessment-question",
      ".assessment-plan-form",
      ".marker-form",
      ".notebook-save--saving",
      ".notebook-save--error",
      '[contenteditable="true"]',
      '[aria-busy="true"]',
    ].join(","),
  );
  return !Array.from(editors).some((element) => {
    if (!element.getClientRects().length) return false;
    const style = document.defaultView?.getComputedStyle(element);
    if (style?.visibility === "hidden" || style?.display === "none") return false;
    // Na entrada, um formulário vazio pode receber a atualização; credenciais digitadas são preservadas.
    if (element.matches("form.login-form"))
      return Array.from(element.querySelectorAll<HTMLInputElement>("input")).some(
        (field) => !!field.value,
      );
    return true;
  });
}
