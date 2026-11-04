import { useEffect, useState } from "react";
import { ArrowUpRight, Plus, RefreshCw } from "lucide-react";
import { supabase } from "./client";
import { officialUrl } from "./domain";

type Source = {
  id: string;
  url: string;
  paused: boolean;
  health: "pending" | "healthy" | "review" | "error";
  last_success_at: string | null;
  last_checked_at: string | null;
  next_check_at: string;
  last_error: string | null;
  requested_at: string | null;
  last_content_hash: string | null;
};
type Version = {
  id: string;
  first_seen_at: string;
  text_content: string;
  needs_review: boolean;
  storage_path: string;
  content_hash: string;
  documents: { url: string; label: string }[];
};
const health = {
  pending: "Aguardando primeira consulta",
  healthy: "Consultada",
  review: "Conteúdo para revisão",
  error: "Falha de coleta",
};
const dateTime = (date: string) => new Date(date).toLocaleString("pt-BR");

export default function SourcesPanel({
  eventId,
  official,
  editable,
}: {
  eventId: string;
  official: string;
  editable: boolean;
}) {
  const [sources, setSources] = useState<Source[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function reload() {
    if (!supabase) return;
    const result = await supabase
      .from("sources")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at");
    if (result.error) throw result.error;
    setSources(result.data);
  }
  useEffect(() => {
    let active = true;
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setSources([]);
    setExpanded(null);
    setVersions([]);
    setError("");
    const client = supabase;
    void client
      .from("sources")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at")
      .then((result) => {
        if (!active) return;
        if (result.error) setError(result.error.message);
        else setSources(result.data);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventId]);
  async function manage(url: string, action: string) {
    if (!supabase || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await supabase.rpc("manage_source", {
        target_event: eventId,
        source_url: officialUrl(url),
        action,
      });
      if (result.error) throw result.error;
      await reload();
      setNotice(
        action === "request"
          ? "Pedido registrado para a próxima rodada, respeitando o intervalo mínimo de uma hora. O agendamento precisa estar habilitado pelo administrador."
          : action === "register"
            ? "Fonte cadastrada. A primeira consulta depende da configuração do coletor."
            : "Configuração da fonte salva.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function openVersions(id: string) {
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const result = await supabase
        .from("source_versions")
        .select(
          "id,first_seen_at,text_content,needs_review,storage_path,documents,content_hash",
        )
        .eq("source_id", id)
        .order("last_seen_at", { ascending: false })
        .limit(5);
      if (result.error) throw result.error;
      setVersions(result.data);
      setExpanded(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function openEvidence(path: string) {
    if (!supabase) return;
    // Abre a aba durante o gesto para evitar bloqueio de popup após await.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    const result = await supabase.storage
      .from("source-evidence")
      .createSignedUrl(path, 60, { download: true });
    if (result.error) {
      tab?.close();
      setError(result.error.message);
    } else if (tab) tab.location.href = result.data.signedUrl;
    else setError("Permita abrir uma nova aba para baixar a evidência.");
  }
  async function acknowledge(source: Source, version: Version, reason: string) {
    if (!supabase || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await supabase.rpc("acknowledge_source", {
        source_uuid: source.id,
        reviewed_hash: version.content_hash,
        reason,
      });
      if (result.error) throw result.error;
      await reload();
      setNotice(
        "Conferência registrada com sua autoria. Cadastre nas etapas os fatos confirmados e suas evidências.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel source-panel">
      <div className="section-heading">
        <h2>Fontes e evidências</h2>
        {supabase && (
          <button
            className="icon-button"
            aria-label="Atualizar situação das fontes"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void reload()
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            <RefreshCw size={24} />
          </button>
        )}
      </div>
      <p className="muted">
        Mudanças de conteúdo precisam de revisão. Uma data prevista não confirma
        publicação de resultado.
      </p>
      {error && (
        <p role="alert" className="source-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!supabase ? (
        <p>
          A coleta exige um espaço conectado. No modo local, consulte a fonte
          oficial e registre as etapas manualmente.
        </p>
      ) : loading ? (
        <p role="status">Carregando fontes…</p>
      ) : (
        <>
          {!sources.length && (
            <p>Nenhuma fonte cadastrada para consulta automática.</p>
          )}
          {sources.map((source) => {
            const late =
              !source.paused &&
              new Date(source.next_check_at).getTime() <
                Date.now() - 6 * 3600_000;
            return (
              <article className="source-item" key={source.id}>
                <a
                  className="source-link"
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.url}
                  <ArrowUpRight size={24} />
                </a>
                <span className="badge">
                  {source.paused ? "Pausada" : health[source.health]}
                </span>
                {late && <span className="badge">Consulta atrasada</span>}
                <p>
                  Último sucesso:{" "}
                  {source.last_success_at
                    ? dateTime(source.last_success_at)
                    : "nenhum"}
                </p>
                {source.last_error && (
                  <p className="source-error">{source.last_error}</p>
                )}
                <div className="source-actions">
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => {
                      void openVersions(source.id);
                    }}
                  >
                    Ver evidências
                  </button>
                  {editable && (
                    <>
                      <button
                        className="button"
                        disabled={busy || source.paused}
                        onClick={() => {
                          void manage(source.url, "request");
                        }}
                      >
                        Solicitar atualização
                      </button>
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() => {
                          void manage(
                            source.url,
                            source.paused ? "resume" : "pause",
                          );
                        }}
                      >
                        {source.paused ? "Retomar" : "Pausar"}
                      </button>
                    </>
                  )}
                </div>
                {expanded === source.id && (
                  <div className="versions">
                    {versions.length === 0 && <p>Nenhuma versão coletada.</p>}
                    {versions.map((version) => (
                      <details key={version.id}>
                        <summary>
                          Encontrada em {dateTime(version.first_seen_at)}
                        </summary>
                        {version.needs_review && (
                          <p>
                            Documento com texto insuficiente em uma ou mais
                            páginas. Requer conferência manual.
                          </p>
                        )}
                        <button
                          className="button"
                          onClick={() => {
                            void openEvidence(version.storage_path);
                          }}
                        >
                          Baixar evidência original <ArrowUpRight size={24} />
                        </button>
                        <pre>
                          {version.text_content || "Nenhum texto legível."}
                        </pre>
                        {editable &&
                          source.health === "review" &&
                          source.last_content_hash === version.content_hash && (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const reason = String(
                                  new FormData(e.currentTarget).get("reason"),
                                );
                                void acknowledge(source, version, reason);
                              }}
                            >
                              <label>
                                O que foi conferido?
                                <textarea
                                  name="reason"
                                  required
                                  minLength={5}
                                  maxLength={1000}
                                  rows={3}
                                />
                              </label>
                              <button className="button" disabled={busy}>
                                Confirmar leitura
                              </button>
                            </form>
                          )}
                        {version.documents.length > 0 && (
                          <>
                            <h3>PDFs encontrados nesta página</h3>
                            <p>
                              Confira edição e organização antes de cadastrar um
                              documento como fonte.
                            </p>
                            <ul>
                              {version.documents.map((doc) => (
                                <li key={doc.url}>
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {doc.label || doc.url}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </details>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
          {editable && sources.length < 3 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const url = String(new FormData(form).get("url"));
                void manage(url, "register");
              }}
            >
              <h3>Adicionar fonte oficial</h3>
              <label>
                Link da página ou PDF
                <input
                  name="url"
                  type="url"
                  defaultValue={official}
                  required
                  maxLength={2048}
                />
              </label>
              <p className="muted">
                Confirme o domínio e a edição. O piloto aceita até três fontes
                por oportunidade.
              </p>
              <button className="button" disabled={busy}>
                <Plus size={24} />
                Cadastrar fonte
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
