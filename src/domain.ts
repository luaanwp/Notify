export const participation = ['Interessados', 'Preparando', 'Inscrição enviada', 'Aguardando', 'Selecionados', 'Não selecionados'] as const;
export type Stage = { id: string; label: string; date: string; evidence: string };
export type Entry = { id: string; name: string; organization: string; edition: string; url: string; owner: string; participation: string; favorite: boolean; stages: Stage[]; history: { at: string; text: string }[]; created_at: string };
export function officialUrl(value: string) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Use um endereço HTTP ou HTTPS sem credenciais.');
  return url.href;
}
export function daysUntil(date: string, now = new Date()) {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = date.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - today) / 86400000);
}
export function nextStage(entry: Entry) { return [...entry.stages].filter(s => daysUntil(s.date) >= 0).sort((a,b) => a.date.localeCompare(b.date))[0]; }
export function displayDate(date: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date + 'T12:00:00')); }
