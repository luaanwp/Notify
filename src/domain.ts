export const participation = [
  "Interessados",
  "Preparando",
  "Inscrição enviada",
  "Aguardando",
  "Selecionados",
  "Não selecionados",
] as const;
export type Stage = {
  id: string;
  label: string;
  date: string;
  evidence: string;
};
export type Entry = {
  id: string;
  name: string;
  organization: string;
  edition: string;
  url: string;
  owner: string;
  participation: string;
  favorite: boolean;
  stages: Stage[];
  history: { at: string; text: string }[];
  created_at: string;
  revision?: number;
};
export function parseEntries(value: unknown): Entry[] {
  if (!Array.isArray(value)) throw new Error("Formato de dados inválido.");
  for (const item of value) {
    if (
      !item ||
      typeof item !== "object" ||
      [
        "id",
        "name",
        "organization",
        "edition",
        "url",
        "owner",
        "participation",
        "created_at",
      ].some((key) => typeof item[key] !== "string") ||
      typeof item.favorite !== "boolean" ||
      !Array.isArray(item.stages) ||
      !Array.isArray(item.history)
    )
      throw new Error("Cadastro inválido.");
    officialUrl(item.url);
    for (const stage of item.stages) {
      if (
        !stage ||
        typeof stage.id !== "string" ||
        typeof stage.label !== "string" ||
        !validDate(stage.date)
      )
        throw new Error("Etapa inválida.");
      officialUrl(stage.evidence);
    }
    if (
      item.history.some(
        (history: { at?: unknown; text?: unknown }) =>
          !history ||
          typeof history.text !== "string" ||
          typeof history.at !== "string" ||
          !Number.isFinite(Date.parse(history.at)),
      )
    )
      throw new Error("Histórico inválido.");
  }
  return value as Entry[];
}
export function validDate(date: unknown): date is string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return false;
  const value = new Date(date + "T00:00:00Z");
  return (
    Number.isFinite(value.getTime()) &&
    value.toISOString().slice(0, 10) === date
  );
}
export function officialUrl(value: string) {
  const url = new URL(value);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Use um endereço HTTP ou HTTPS sem credenciais.");
  return url.href;
}
export function daysUntil(date: string, now = new Date()) {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = date.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - today) / 86400000);
}
export function nextStage(entry: Entry) {
  return [...entry.stages]
    .filter((s) => daysUntil(s.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
}
export function displayDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date + "T12:00:00"));
}
