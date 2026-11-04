import { useEffect, useState } from 'react';
import { ArrowUpRight, Bell, Bookmark, CalendarDays, Check, ChevronLeft, CircleHelp, LayoutList, Plus, Search, Settings, X } from 'lucide-react';
import { supabase } from './client';
import { daysUntil, displayDate, nextStage, officialUrl, participation, type Entry } from './domain';

const key = 'notify.local.v1';
export default function App() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState('Oportunidades');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todas');
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!supabase) {
      try { setEntries(JSON.parse(localStorage.getItem(key) || '[]')); } catch { setError('Os dados locais não puderam ser lidos. Exporte uma cópia antes de limpar o navegador.'); }
      setReady(true); return;
    }
    const client = supabase;
    async function load() {
      setReady(false);
      try {
        const { data: { session } } = await client.auth.getSession();
        setUser(session?.user.email || null);
        if (!session) { setEntries([]); return; }
        const membership = await client.from('memberships').select('workspace_id').limit(1).maybeSingle();
        if (membership.error) throw membership.error;
        if (!membership.data) throw new Error('Sua conta ainda não pertence a uma equipe. Peça ao administrador para liberar o acesso.');
        setWorkspace(membership.data.workspace_id);
        const result = await client.from('events').select('payload').eq('workspace_id', membership.data.workspace_id).order('created_at', { ascending: false });
        if (result.error) throw result.error;
        setEntries(result.data.map(row => row.payload as Entry));
      } catch (e) { setError((e as Error).message); } finally { setReady(true); }
    }
    void load();
    const { data } = client.auth.onAuthStateChange(() => { void load(); });
    return () => data.subscription.unsubscribe();
  }, []);
  async function save(entry: Entry) {
    setBusy(true); setError('');
    try {
      if (supabase) {
        if (!workspace) throw new Error('Nenhuma equipe autorizada.');
        const result = await supabase.rpc('save_event', { target_workspace: workspace, event_payload: entry });
        if (result.error) throw result.error;
      }
      const updated = [entry, ...entries.filter(e => e.id !== entry.id)];
      if (!supabase) localStorage.setItem(key, JSON.stringify(updated));
      setEntries(updated); return true;
    } catch(e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  }
  const active = entries.find(e => e.id === selected);
  const deadlines = entries.flatMap(e => e.stages.map(s => ({ ...s, event: e }))).filter(s => daysUntil(s.date) >= 0).sort((a,b) => a.date.localeCompare(b.date));
  const shown = entries.filter(e => `${e.name} ${e.organization} ${e.owner}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).filter(e => filter === 'Todas' || (filter === 'Favoritas' ? e.favorite : e.stages.some(s => daysUntil(s.date) >= 0 && daysUntil(s.date) <= 7)));
  function exportData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'notify-oportunidades.json'; a.click(); URL.revokeObjectURL(url);
  }
  return <div className="shell">
    <aside className="sidebar"><a href="#" className="brand" onClick={() => { setPage('Oportunidades'); setSelected(null); }}><span className="brand-mark"><Bell size={24}/></span>notify<span className="brand-dot">.</span></a><div className="team"><span className="avatar">C</span><div><strong>CartAI</strong><small>Espaço da equipe</small></div></div><nav aria-label="Navegação principal">{[['Oportunidades', LayoutList], ['Prazos', CalendarDays], ['Configurações', Settings]].map(([label, Icon]) => <button key={label as string} className={page === label ? 'nav active' : 'nav'} onClick={() => { setPage(label as string); setSelected(null); setAdding(false); }}><Icon size={24}/>{label as string}{label === 'Oportunidades' && <span className="count">{entries.length}</span>}</button>)}</nav><div className="sidebar-bottom"><CircleHelp size={24}/><p>Da oportunidade ao próximo passo.<small>Etapas e evidências em um só lugar.</small></p></div></aside>
    <div className="content"><header className="topbar"><span>Espaço de trabalho <span className="slash">/</span> {page}</span><span className="account"><span className="status-dot"/>{supabase ? user || 'Acesso privado' : 'Modo local'}<span className="avatar small">{user ? user[0].toUpperCase() : 'C'}</span></span></header>
      <main>{error && <div className="message error" role="alert">{error}<button aria-label="Fechar erro" onClick={() => setError('')}><X size={24}/></button></div>}{notice && <div className="message" role="status">{notice}<button aria-label="Fechar aviso" onClick={() => setNotice('')}><X size={24}/></button></div>}
      {!ready ? <p role="status">Carregando oportunidades…</p> : supabase && !user ? <section className="welcome"><Bell size={40}/><h1>O próximo passo da sua equipe.</h1><p>Acesse para acompanhar oportunidades, prazos e publicações oficiais.</p><button className="primary" onClick={async () => { const result = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } }); if (result.error) setError(result.error.message); }}>Entrar com Google <ArrowUpRight size={24}/></button><small>Acesso restrito a integrantes autorizados.</small></section> : <>
      {active ? <><button className="back" onClick={() => setSelected(null)}><ChevronLeft size={24}/>Todas as oportunidades</button><div className="page-heading"><div><h1>{active.name}</h1><p>{active.organization} {active.edition && `· ${active.edition}`}</p></div><a className="button" href={active.url} target="_blank" rel="noreferrer">Fonte oficial <ArrowUpRight size={24}/></a></div><div className="detail-grid"><section className="panel"><h2>Etapas e prazos</h2><p className="muted">Datas informadas manualmente. Horário limite não informado.</p>{active.stages.length === 0 && <p className="empty-inline">Nenhuma etapa cadastrada.</p>}{active.stages.map(s => <div className="stage" key={s.id}><CalendarDays size={24}/><div><strong>{s.label}</strong><p>{displayDate(s.date)} · precisão de dia</p><a href={s.evidence} target="_blank" rel="noreferrer">Abrir evidência <ArrowUpRight size={16}/></a></div></div>)}<form onSubmit={async e => { e.preventDefault(); const form = e.currentTarget; const data = new FormData(form); try { const evidence = officialUrl(String(data.get('evidence'))); const label = String(data.get('label')).trim(); if (!label) throw new Error('Informe o nome da etapa.'); if (await save({ ...active, stages: [...active.stages, { id: crypto.randomUUID(), label, date: String(data.get('date')), evidence }], history: [{ at: new Date().toISOString(), text: `Etapa adicionada manualmente: ${label}.` }, ...active.history] })) form.reset(); } catch(e) { setError((e as Error).message); } }}><h3>Adicionar etapa</h3><label>Nome da etapa<input name="label" required maxLength={160} placeholder="Ex.: Inscrições"/></label><label>Data prevista<input name="date" type="date" required/></label><label>URL da evidência<input name="evidence" type="url" required placeholder="https://"/></label><button className="primary" disabled={busy}>Salvar etapa <Plus size={24}/></button></form></section><div><section className="panel"><h2>Participação da equipe</h2><label>Situação interna<select value={active.participation} disabled={busy} onChange={e => { void save({ ...active, participation: e.target.value, history: [{ at: new Date().toISOString(), text: `Participação alterada para ${e.target.value}.` }, ...active.history] }); }}>{participation.map(p => <option key={p}>{p}</option>)}</select></label><p>Responsável: {active.owner || 'Não definido'}</p><span className="badge">Coleta não configurada</span><p className="muted">Nenhuma verificação automática foi realizada.</p></section><section className="panel"><h2>Histórico</h2>{active.history.map((h,i) => <div className="history" key={i}><span className="history-dot"/><div><p>{h.text}</p><small>{new Date(h.at).toLocaleString('pt-BR')}</small></div></div>)}</section></div></div></> : page === 'Configurações' ? <><div className="page-heading"><div><h1>Configurações</h1><p>Dados, acesso e funcionamento do espaço.</p></div></div><section className="panel settings"><h2>{supabase ? 'Espaço compartilhado' : 'Seu espaço local'}</h2><p>{supabase ? `Conectado como ${user}. Permissões controladas por associação à equipe.` : 'Os cadastros ficam somente neste navegador. Não há sincronização com a equipe nem monitoramento em segundo plano.'}</p><button className="button" onClick={exportData}>Exportar dados em JSON <ArrowUpRight size={24}/></button><h2>Monitoramento e alertas</h2><p>A coleta automática, interpretação por IA e Telegram ainda não estão ativos. A configuração será disponibilizada nas próximas entregas.</p>{supabase && <button className="button" onClick={() => { void supabase!.auth.signOut(); }}>Sair da conta</button>}</section></> : <>
      <div className="page-heading"><div><h1>{page === 'Prazos' ? 'Os próximos passos.' : 'Oportunidades no radar.'}</h1><p>{page === 'Prazos' ? 'Organize a agenda a partir das etapas cadastradas.' : 'Acompanhe o que importa. Prepare o que vem a seguir.'}</p></div>{page === 'Oportunidades' && <button className="primary" onClick={() => setAdding(!adding)}>{adding ? <X size={24}/> : <Plus size={24}/>} {adding ? 'Fechar cadastro' : 'Adicionar oportunidade'}</button>}</div>
      {!supabase && <div className="local-note"><span className="badge">Modo local</span><p>Comece por aqui. Os dados ficam neste navegador até conectar o Supabase.</p></div>}
      {adding && <section className="panel"><h2>Uma nova oportunidade</h2><p className="muted">Cole a fonte oficial e preencha os dados conhecidos. Você pode adicionar etapas depois.</p><form className="event-form" onSubmit={async e => { e.preventDefault(); const data = new FormData(e.currentTarget); try { const name = String(data.get('name')).trim(); if (!name) throw new Error('Informe o nome da oportunidade.'); const now = new Date().toISOString(); const entry: Entry = { id: crypto.randomUUID(), name, organization: String(data.get('organization')).trim(), edition: String(data.get('edition')).trim(), url: officialUrl(String(data.get('url'))), owner: String(data.get('owner')).trim(), participation: 'Interessados', favorite: false, stages: [], history: [{ at: now, text: 'Oportunidade cadastrada manualmente.' }], created_at: now }; if (await save(entry)) { setAdding(false); setSelected(entry.id); } } catch(e) { setError((e as Error).message); } }}><label>Nome da oportunidade<input name="name" required maxLength={200} autoFocus/></label><label>Link oficial<input name="url" type="url" required placeholder="https://"/></label><label>Organização<input name="organization" maxLength={200}/></label><label>Edição<input name="edition" maxLength={80}/></label><label>Responsável<input name="owner" maxLength={120}/></label><div className="form-action"><button className="primary" disabled={busy}>Salvar oportunidade <Check size={24}/></button></div></form></section>}
      {page === 'Prazos' ? <section className="panel"><h2>Prazos cadastrados</h2>{deadlines.length ? deadlines.map(s => <button className="deadline-row" key={s.id} onClick={() => setSelected(s.event.id)}><span className="date-block">{displayDate(s.date)}</span><span><strong>{s.label}</strong><small>{s.event.name}</small></span><ArrowUpRight size={24}/></button>) : <div className="empty"><CalendarDays size={40}/><h2>Sua agenda começa com uma etapa.</h2><p>Adicione prazos às oportunidades para acompanhar os próximos dias.</p></div>}</section> : <>
      <section className="overview" aria-label="Resumo"><div><span>Em acompanhamento</span><strong>{entries.length.toString().padStart(2,'0')}</strong></div><div><span>Prazos em 7 dias</span><strong>{deadlines.filter(s => daysUntil(s.date) <= 7).length.toString().padStart(2,'0')}</strong></div><div><span>Coleta automática</span><strong className="text-stat">Não configurada</strong></div></section>
      <section className="list-section"><div className="list-toolbar"><div className="tabs" aria-label="Filtrar oportunidades">{['Todas','Próximos prazos','Favoritas'].map(f => <button aria-pressed={filter === f} className={filter === f ? 'tab selected' : 'tab'} key={f} onClick={() => setFilter(f)}>{f}</button>)}</div><label className="search"><Search size={24}/><input aria-label="Buscar oportunidade" placeholder="Buscar oportunidade" value={query} onChange={e => setQuery(e.target.value)}/></label></div>{shown.length ? <div className="table-wrap"><table><thead><tr><th>Oportunidade</th><th>Participação</th><th>Próximo prazo</th><th>Responsável</th><th><span className="sr-only">Favorito</span></th></tr></thead><tbody>{shown.map(e => { const stage = nextStage(e); return <tr key={e.id}><td><button className="event-title" onClick={() => setSelected(e.id)}>{e.name}<ArrowUpRight size={16}/></button><small>{[e.organization,e.edition].filter(Boolean).join(' · ') || 'Organização não informada'}</small></td><td><span className="badge">{e.participation}</span><small>Processo: etapas manuais</small></td><td>{stage ? <>{displayDate(stage.date)}<small>{stage.label}</small></> : <span className="muted">Sem prazo cadastrado</span>}</td><td>{e.owner || 'Não definido'}</td><td><button className="icon-button" aria-label={e.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} aria-pressed={e.favorite} disabled={busy} onClick={() => { void save({ ...e, favorite: !e.favorite }); }}><Bookmark size={24} fill={e.favorite ? 'currentColor' : 'none'}/></button></td></tr>; })}</tbody></table></div> : <div className="empty"><div className="empty-icon"><LayoutList size={40}/></div><h2>{entries.length ? 'Nenhuma oportunidade encontrada.' : 'Uma boa oportunidade merece acompanhamento.'}</h2><p>{entries.length ? 'Tente outro termo ou filtro para encontrar o que procura.' : 'Adicione o primeiro link oficial. Reúna etapas, prazos e decisões da equipe em um só lugar.'}</p>{!entries.length && <button className="button" onClick={() => setAdding(true)}>Cadastrar a primeira oportunidade <Plus size={24}/></button>}</div>}<div className="list-footer"><span>{shown.length} {shown.length === 1 ? 'oportunidade' : 'oportunidades'}</span><span>Atualizações manuais · sem coleta ativa</span></div></section></>}
      </>}
      <footer>Notify <span>Um lugar para acompanhar o próximo passo.</span></footer></>}
      </main></div></div>;
}
