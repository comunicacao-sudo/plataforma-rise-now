const managedDialogSelector = [
  '.content-modal[role="dialog"][aria-modal="true"]',
  '.lesson-screen[role="dialog"][aria-modal="true"]',
  '.journey-editor-modal[role="dialog"][aria-modal="true"]',
  '.assessment-release-preview[role="dialog"][aria-modal="true"]',
].join(",");

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function visible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && !element.hidden;
}

function dialogs() {
  return Array.from(document.querySelectorAll<HTMLElement>(managedDialogSelector)).filter(visible);
}

function focusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(visible);
}

function labelDialog(dialog: HTMLElement, sequence: number) {
  if (dialog.hasAttribute("aria-label") || dialog.hasAttribute("aria-labelledby")) return;
  const heading = dialog.querySelector<HTMLElement>("h1, h2, h3");
  if (!heading) return;
  if (!heading.id) heading.id = `rise-dialog-title-${sequence}`;
  dialog.setAttribute("aria-labelledby", heading.id);
}

export function installDialogAccessibility() {
  const returnFocus = new Map<HTMLElement, HTMLElement | null>();
  const generatedTabIndex = new Set<HTMLElement>();
  let sequence = 0;

  function synchronize() {
    const currentDialogs = dialogs();
    for (const dialog of currentDialogs) {
      if (returnFocus.has(dialog)) continue;
      returnFocus.set(
        dialog,
        document.activeElement instanceof HTMLElement ? document.activeElement : null,
      );
      labelDialog(dialog, ++sequence);
      if (!dialog.hasAttribute("tabindex")) {
        dialog.tabIndex = -1;
        generatedTabIndex.add(dialog);
      }
      queueMicrotask(() => {
        if (!dialog.isConnected || dialogs().at(-1) !== dialog) return;
        (focusableElements(dialog)[0] ?? dialog).focus({ preventScroll: true });
      });
    }

    for (const [dialog, trigger] of returnFocus) {
      if (dialog.isConnected) continue;
      returnFocus.delete(dialog);
      generatedTabIndex.delete(dialog);
      if (trigger?.isConnected) queueMicrotask(() => trigger.focus({ preventScroll: true }));
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    const dialog = dialogs().at(-1);
    if (!dialog) return;

    if (event.key === "Escape") {
      const close = dialog.querySelector<HTMLButtonElement>(
        '.modal-close:not([disabled]), [data-dialog-close]:not([disabled]), button[aria-label="Fechar"]:not([disabled])',
      );
      if (close) {
        event.preventDefault();
        close.click();
      }
      return;
    }

    if (event.key !== "Tab") return;
    const elements = focusableElements(dialog);
    if (!elements.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = elements[0]!;
    const last = elements[elements.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onFocusIn(event: FocusEvent) {
    const dialog = dialogs().at(-1);
    if (!dialog || dialog.contains(event.target as Node)) return;
    (focusableElements(dialog)[0] ?? dialog).focus({ preventScroll: true });
  }

  const observer = new MutationObserver(synchronize);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("focusin", onFocusIn, true);
  synchronize();

  return () => {
    observer.disconnect();
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("focusin", onFocusIn, true);
    for (const dialog of generatedTabIndex) {
      if (dialog.isConnected) dialog.removeAttribute("tabindex");
    }
  };
}
