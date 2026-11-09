import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { listTrash, restoreTrashResource } from "@/lib/protected.functions";
import { protectedResources } from "../../supabase/functions/_shared/protected-resources";
import { confirmProtectedOperation } from "@/lib/protected-dialog";
import { invalidateTrashData } from "@/lib/trash-sync";
export function TrashPanel() {
  const qc = useQueryClient(),
    load = useServerFn(listTrash),
    restore = useServerFn(restoreTrashResource);
  const [offset, setOffset] = useState(0),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["protected-trash", offset],
    queryFn: () => load({ data: { offset } }),
    retry: false,
  });
  async function recover(item: NonNullable<typeof query.data>["items"][number]) {
    const note =
      item.type === "meeting"
        ? " A recuperação mantém o registro na RISE; confira também o Google Agenda."
        : item.type === "automation"
          ? " A automação volta desativada para você revisar antes de retomar os avisos."
          : item.type === "draft_step"
            ? " A etapa volta para o rascunho e precisa ser publicada depois."
            : "";
    const proof = await confirmProtectedOperation({
      scope: { type: "trash", id: item.id, operation: "restore" },
      title: "Recuperar registro?",
      description: `Recuperar “${item.label}” da lixeira?${note}`,
    });
    if (!proof) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await restore({ data: { id: item.id, proof } });
      setMessage(result.message);
      await invalidateTrashData(qc);
      if (query.data?.items.length === 1 && offset > 0) setOffset(Math.max(0, offset - 50));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível recuperar o registro.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-card trash-panel" aria-labelledby="trash-panel-title">
      <div className="section-heading">
        <div>
          <h2 id="trash-panel-title">
            <Trash2 size={22} /> Lixeira
          </h2>
          <p>
            Você pode recuperar os registros por 30 dias. Depois, os dados e arquivos exclusivos
            deles são apagados definitivamente da RISE.
          </p>
        </div>
      </div>
      {message && <p role="status">{message}</p>}
      {query.isLoading ? (
        <p role="status">Carregando lixeira…</p>
      ) : query.isError ? (
        <p role="alert">
          Não foi possível carregar a lixeira.{" "}
          <button type="button" onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        </p>
      ) : !query.data?.items.length ? (
        <p className="ops-empty-row">A lixeira está vazia.</p>
      ) : (
        <ul className="trash-list">
          {query.data.items.map((item) => (
            <li key={item.id}>
              <div>
                <span className="eyebrow">{protectedResources[item.type]}</span>
                <h3>{item.label}</h3>
                <p>
                  Excluído em {new Date(item.deletedAt).toLocaleString("pt-BR")} por{" "}
                  {item.deletedBy}.
                </p>
                <p>
                  {item.purgePending
                    ? "Prazo encerrado · exclusão definitiva em processamento"
                    : `Recuperável até ${new Date(item.expiresAt).toLocaleString("pt-BR")}`}
                </p>
              </div>
              <button
                type="button"
                className="button button--glass"
                disabled={busy || !item.canRestore}
                title={
                  !item.canRestore
                    ? "A recuperação depende da pessoa responsável por este registro."
                    : undefined
                }
                onClick={() => void recover(item)}
              >
                <RotateCcw size={16} /> Recuperar
              </button>
            </li>
          ))}
        </ul>
      )}
      {!!query.data?.total && (
        <div className="trash-pagination">
          <span>
            {offset + 1}–{Math.min(offset + 50, query.data.total)} de {query.data.total}
          </span>
          <button
            type="button"
            disabled={busy || offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 50))}
          >
            Anteriores
          </button>
          <button
            type="button"
            disabled={busy || offset + 50 >= query.data.total}
            onClick={() => setOffset(offset + 50)}
          >
            Próximos
          </button>
        </div>
      )}
    </section>
  );
}
