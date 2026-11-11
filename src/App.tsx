import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { currentAccount, login, logout, redirectUri } from './auth';
import { clientId, COLLECTION, KREIS } from './config';
import { activeCount, Catalog, dayLabel, demoCatalog, demoImage, emptyFilter, facets, Filter, folder, Item, matches, name, prepare } from './data';
import { cached, loadCatalog, loadLinks, originalUrl } from './graph';

type Phase = 'setup' | 'login' | 'loading' | 'ready' | 'error';

const DEMO = new URLSearchParams(location.search).has('demo');

export default function App() {
  const [demo, setDemo] = useState(DEMO);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [user, setUser] = useState('');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [filter, setFilter] = useState<Filter>(emptyFilter);
  const [sheet, setSheet] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);

  const start = useCallback(async () => {
    setError('');
    if (demo) {
      setCatalog(demoCatalog());
      setPhase('ready');
      return;
    }
    if (!clientId()) return setPhase('setup');
    setPhase('loading');
    try {
      const account = await currentAccount();
      if (!account) return setPhase('login');
      setUser(account.username);
      setCatalog(await loadCatalog());
      setPhase('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  }, [demo]);
  useEffect(() => void start(), [start]);

  const items = useMemo(() => (catalog ? prepare(catalog) : []), [catalog]);
  const shown = useMemo(() => items.filter((it) => matches(it, filter)), [items, filter]);
  const lists = useMemo(() => (catalog ? facets(catalog, items) : null), [catalog, items]);

  // Zurück-Taste des Handys schließt erst Einzelansicht bzw. Filter, statt die App zu verlassen
  const overlay = viewer != null || sheet;
  useEffect(() => {
    if (!overlay) return;
    history.pushState({ overlay: true }, '');
    const onPop = () => {
      setViewer(null);
      setSheet(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [overlay]);
  const closeOverlay = () => history.back();

  if (phase === 'setup') return <Setup onDone={start} onDemo={() => setDemo(true)} />;
  if (phase === 'login') {
    return (
      <Splash>
        <p>Melde dich mit dem Microsoft-Konto an, in dessen OneDrive deine Bilder liegen. Die App kann dort nur lesen, nichts ändern oder löschen.</p>
        <button className="btn primary" onClick={() => void login()}>Mit Microsoft anmelden</button>
        <button className="btn" onClick={() => setDemo(true)}>Erst mit Beispieldaten ansehen</button>
      </Splash>
    );
  }
  if (phase === 'loading') return <Splash><p className="muted">Katalog wird geladen …</p></Splash>;
  if (phase === 'error') {
    return (
      <Splash>
        <p className="warn">{error}</p>
        <button className="btn primary" onClick={() => void start()}>Erneut versuchen</button>
        <button className="btn" onClick={() => void logout()}>Abmelden</button>
      </Splash>
    );
  }

  const n = activeCount(filter);
  return (
    <div className="app">
      <header className="top">
        <div className="top-title">
          <strong>MaxGallerie{demo && ' · Beispiel'}</strong>
          <span className="muted">
            {shown.length.toLocaleString('de-DE')} {n > 0 ? 'Treffer' : 'Dateien'}
          </span>
        </div>
        {n > 0 && (
          <button className="btn small" onClick={() => setFilter(emptyFilter)}>Zurücksetzen</button>
        )}
        <button className={`btn small${n > 0 ? ' primary' : ''}`} onClick={() => setSheet(true)}>
          Filter{n > 0 && ` (${n})`}
        </button>
      </header>

      {shown.length === 0 ? (
        <div className="empty">{items.length === 0 ? 'Der Katalog enthält noch keine Dateien aus OneDrive. Lies in der Desktop-App einen OneDrive-Ordner ein und exportiere den Katalog neu.' : 'Keine Dateien für diese Filter.'}</div>
      ) : (
        <Grid items={shown} demo={demo} onOpen={setViewer} />
      )}

      {sheet && lists && catalog && (
        <FilterSheet
          filter={filter}
          lists={lists}
          user={demo ? 'Beispieldaten' : user}
          onChange={setFilter}
          onClose={closeOverlay}
          onReload={() => {
            closeOverlay();
            void start();
          }}
          onLogout={demo ? () => location.assign(location.pathname) : () => void logout()}
        />
      )}
      {viewer != null && shown[viewer] && catalog && (
        <Viewer items={shown} index={viewer} catalog={catalog} demo={demo} onIndex={setViewer} onClose={closeOverlay} />
      )}
    </div>
  );
}

function Splash({ children }: { children: React.ReactNode }) {
  return (
    <div className="splash">
      <img src="./icon-192.png" width={72} height={72} alt="" />
      <h1>MaxGallerie</h1>
      {children}
    </div>
  );
}

/** Erster Start: die Anwendungs-ID der Microsoft-Registrierung eintragen. */
function Setup({ onDone, onDemo }: { onDone: () => void; onDemo: () => void }) {
  const [id, setId] = useState('');
  const valid = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id.trim());
  return (
    <Splash>
      <p>Damit die App deine Bilder aus OneDrive lesen darf, braucht sie einmalig die Anwendungs-ID deiner Microsoft-Registrierung.</p>
      <input value={id} onChange={(e) => setId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" inputMode="text" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      <button
        className="btn primary"
        disabled={!valid}
        onClick={() => {
          localStorage.setItem('clientId', id.trim());
          onDone();
        }}
      >
        Speichern und weiter
      </button>
      <button className="btn" onClick={onDemo}>Erst mit Beispieldaten ansehen</button>
      <p className="muted small">
        Bei der Registrierung muss als Umleitungsadresse (Single-Page-Anwendung) eingetragen sein:
        <br />
        <code>{redirectUri()}</code>
      </p>
    </Splash>
  );
}

// ---------- Galerie ----------

interface Row {
  y: number;
  h: number;
  /** Überschrift (Tag) oder Kachelzeile ab `start` */
  label?: string;
  count?: number;
  start: number;
  n: number;
}

const GAP = 3;
const HEAD = 40;

function layout(items: Item[], width: number): { rows: Row[]; total: number; tile: number } {
  const cols = Math.max(3, Math.floor(width / 118));
  const tile = (width - GAP * (cols - 1)) / cols;
  const rows: Row[] = [];
  let y = 0;
  let from = 0;
  for (let i = 1; i <= items.length; i++) {
    if (i < items.length && (items[i].d ?? '').slice(0, 10) === (items[from].d ?? '').slice(0, 10)) continue;
    rows.push({ y, h: HEAD, label: dayLabel(items[from]), count: i - from, start: from, n: 0 });
    y += HEAD;
    for (let s = from; s < i; s += cols) {
      rows.push({ y, h: tile, start: s, n: Math.min(cols, i - s) });
      y += tile + GAP;
    }
    from = i;
  }
  return { rows, total: y, tile };
}

/** Lädt Vorschaubild-Adressen für die gerade sichtbaren Dateien und zeichnet neu, sobald sie da sind. */
function useLinks(paths: string[], demo: boolean): number {
  const [version, setVersion] = useState(0);
  const key = paths.join('|');
  useEffect(() => {
    if (demo) return;
    const missing = paths.filter((p) => !cached(p));
    if (missing.length === 0) return;
    let stale = false;
    const t = setTimeout(() => {
      loadLinks(missing)
        .catch(() => {})
        .finally(() => !stale && setVersion((v) => v + 1));
    }, 150);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [key, demo]); // eslint-disable-line react-hooks/exhaustive-deps
  return version;
}

function Grid({ items, demo, onOpen }: { items: Item[]; demo: boolean; onOpen: (index: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [top, setTop] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current!;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { rows, total, tile } = useMemo(() => layout(items, size.w), [items, size.w]);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [items]);

  const visible = size.w > 0 ? rows.filter((r) => r.y + r.h > top - 500 && r.y < top + size.h + 500) : [];
  const paths = visible.filter((r) => !r.label).flatMap((r) => items.slice(r.start, r.start + r.n).map((it) => it.p));
  useLinks(paths, demo);

  return (
    <div className="grid" ref={ref} onScroll={(e) => setTop(e.currentTarget.scrollTop)}>
      <div style={{ height: total, position: 'relative' }}>
        {visible.map((r) =>
          r.label ? (
            <div key={`h${r.start}`} className="day" style={{ top: r.y, height: HEAD }}>
              <strong>{r.label}</strong>
              <span className="muted">{r.count}</span>
            </div>
          ) : (
            items.slice(r.start, r.start + r.n).map((it, i) => {
              const src = demo ? demoImage(it, 240) : cached(it.p)?.thumb;
              return (
                <button key={it.p} className="tile" style={{ top: r.y, left: i * (tile + GAP), width: tile, height: tile }} onClick={() => onOpen(r.start + i)}>
                  {src ? <img src={src} alt="" loading="lazy" draggable={false} /> : <span className="ph">{it.k === 'v' ? '▶' : ''}</span>}
                  {it.k === 'v' && <span className="badge">▶</span>}
                  {it.r ? <span className="badge star">★ {it.r}</span> : null}
                </button>
              );
            })
          ),
        )}
      </div>
    </div>
  );
}

// ---------- Filter ----------

interface SheetProps {
  filter: Filter;
  lists: ReturnType<typeof facets>;
  user: string;
  onChange: (f: Filter) => void;
  onClose: () => void;
  onReload: () => void;
  onLogout: () => void;
}

function FilterSheet({ filter, lists, user, onChange, onClose, onReload, onLogout }: SheetProps) {
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const chip = (id: number, label: string) => (
    <button key={id} className={`chip${filter.tags.includes(id) ? ' on' : ''}`} onClick={() => onChange({ ...filter, tags: toggle(filter.tags, id) })}>
      {label} <small>{lists.tagCount.get(id)}</small>
    </button>
  );
  return (
    <div className="sheet-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-label="Filter">
        <div className="sheet-head">
          <strong>Filter</strong>
          <button className="btn small" onClick={() => onChange(emptyFilter)} disabled={activeCount(filter) === 0}>Alle zurücksetzen</button>
          <button className="btn small primary" onClick={onClose}>Fertig</button>
        </div>

        <input className="search" type="search" placeholder="Dateiname oder Ordner" value={filter.search} onChange={(e) => onChange({ ...filter, search: e.target.value })} />

        <h3>Art</h3>
        <div className="chips">
          {([['', 'Alle'], ['i', 'Bilder'], ['v', 'Videos']] as const).map(([k, label]) => (
            <button key={k} className={`chip${filter.kind === k ? ' on' : ''}`} onClick={() => onChange({ ...filter, kind: k })}>{label}</button>
          ))}
        </div>

        {lists.collections.length > 0 && (
          <>
            <h3>Sammlungen</h3>
            <div className="chips">{lists.collections.map((t) => chip(t.id, t.name))}</div>
          </>
        )}

        {lists.groups.length > 0 && <h3>Tags</h3>}
        {lists.groups.map(([g, list]) => (
          <div key={g} className="group">
            <span className="muted small">{g || 'Ohne Gruppe'}</span>
            <div className="chips">{list.map((t) => chip(t.id, t.name))}</div>
          </div>
        ))}

        <h3>Bewertung</h3>
        <div className="chips">
          {[0, 1, 2, 3, 4, 5].map((r) => (
            <button key={r} className={`chip${filter.minRating === r ? ' on' : ''}`} onClick={() => onChange({ ...filter, minRating: r })}>
              {r === 0 ? 'Alle' : `ab ${'★'.repeat(r)}`}
            </button>
          ))}
        </div>

        {lists.tones.size > 0 && (
          <>
            <h3>Farben</h3>
            <div className="tones">
              {KREIS.map(([tone, hex]) => (
                <button
                  key={tone}
                  className={filter.colors.includes(tone) ? 'on' : ''}
                  style={{ background: hex }}
                  aria-label={tone}
                  title={tone}
                  disabled={!lists.tones.has(tone)}
                  onClick={() => onChange({ ...filter, colors: toggle(filter.colors, tone) })}
                />
              ))}
            </div>
            <div className="chips">
              <button className={`chip${filter.colorMain ? ' on' : ''}`} onClick={() => onChange({ ...filter, colorMain: !filter.colorMain })}>Nur Hauptfarbe</button>
              {filter.colors.length > 0 && <span className="muted small">{filter.colors.join(', ')}</span>}
            </div>
          </>
        )}

        {lists.cameras.length > 0 && (
          <>
            <h3>Geräte</h3>
            <div className="chips">
              {lists.cameras.map(([cam, count]) => (
                <button key={cam} className={`chip${filter.camera === cam ? ' on' : ''}`} onClick={() => onChange({ ...filter, camera: filter.camera === cam ? null : cam })}>
                  {cam} <small>{count}</small>
                </button>
              ))}
            </div>
          </>
        )}

        <h3>Ordner</h3>
        <div className="folders">
          {lists.folders.map(([path, count]) => (
            <button
              key={path}
              className={filter.folder === path ? 'on' : ''}
              style={{ paddingLeft: 10 + (path.split('/').length - 1) * 16 }}
              onClick={() => onChange({ ...filter, folder: filter.folder === path ? null : path })}
            >
              <span>{path.slice(path.lastIndexOf('/') + 1)}</span>
              <small>{count}</small>
            </button>
          ))}
        </div>

        <div className="sheet-foot">
          <span className="muted small">{user}</span>
          <button className="btn small" onClick={onReload}>Katalog neu laden</button>
          <button className="btn small" onClick={onLogout}>Abmelden</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Einzelansicht ----------

interface ViewerProps {
  items: Item[];
  index: number;
  catalog: Catalog;
  demo: boolean;
  onIndex: (i: number) => void;
  onClose: () => void;
}

function Viewer({ items, index, catalog, demo, onIndex, onClose }: ViewerProps) {
  const it = items[index];
  const [info, setInfo] = useState(false);
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const [video, setVideo] = useState<string | null>(null);
  const [sharp, setSharp] = useState<string | null>(null);
  // Nachbarn mitladen, damit das Wischen sofort ein Bild zeigt
  const version = useLinks([it.p, items[index + 1]?.p, items[index - 1]?.p].filter(Boolean) as string[], demo);
  const links = cached(it.p);
  const src = demo ? demoImage(it, 1200) : sharp ?? links?.large ?? links?.thumb;
  void version;

  useEffect(() => {
    setView({ s: 1, x: 0, y: 0 });
    setVideo(null);
    setSharp(null);
  }, [it.p]);

  const go = (d: number) => {
    const next = index + d;
    if (next >= 0 && next < items.length) onIndex(next);
  };

  /** Original nachladen: Video abspielen bzw. Bild in voller Schärfe (nur Formate, die das Handy zeigen kann). */
  const loadOriginal = async () => {
    if (demo) return;
    try {
      const url = await originalUrl(it.p);
      if (!url) return;
      if (it.k === 'v') setVideo(url);
      else setSharp(url);
    } catch {
      /* Vorschau bleibt stehen */
    }
  };

  // Gesten: ein Finger wischt (oder verschiebt, wenn vergrößert), zwei Finger zoomen, Doppeltipp zoomt
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startX: number; startY: number; view: typeof view; dist: number; moved: boolean; lastTap: number }>({ startX: 0, startY: 0, view, dist: 0, moved: false, lastTap: 0 });
  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    g.view = view;
    g.moved = false;
    if (pts.length === 1) {
      g.startX = e.clientX;
      g.startY = e.clientY;
    } else if (pts.length === 2) {
      g.dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    if (pts.length === 2 && g.dist > 0) {
      const s = Math.min(8, Math.max(1, (g.view.s * Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)) / g.dist));
      g.moved = true;
      setView(s === 1 ? { s: 1, x: 0, y: 0 } : { s, x: g.view.x, y: g.view.y });
    } else if (pts.length === 1) {
      const [dx, dy] = [e.clientX - g.startX, e.clientY - g.startY];
      if (Math.abs(dx) + Math.abs(dy) > 8) g.moved = true;
      if (g.view.s > 1) setView({ s: g.view.s, x: g.view.x + dx, y: g.view.y + dy });
      else setView({ s: 1, x: dx, y: 0 });
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    const dx = e.clientX - g.startX;
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (!wasSingle) return;
    if (view.s === 1) {
      setView({ s: 1, x: 0, y: 0 });
      if (Math.abs(dx) > 60) return go(dx < 0 ? 1 : -1);
    }
    if (!g.moved) {
      const now = Date.now();
      if (now - g.lastTap < 300) setView(view.s > 1 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 });
      g.lastTap = now;
    }
  };

  const tags = (it.t ?? []).map((id) => catalog.tags.find((t) => t.id === id)).filter(Boolean) as Catalog['tags'];
  const date = it.d ? new Date(it.d.replace(' ', 'T')).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '';

  return (
    <div className="viewer">
      <header>
        <button className="icon" onClick={onClose} aria-label="Schließen">✕</button>
        <div className="viewer-title">
          <strong>{name(it)}</strong>
          <span className="muted">
            {index + 1} / {items.length}
            {date && ` · ${date}`}
          </span>
        </div>
        {it.r ? <span className="stars">{'★'.repeat(it.r)}</span> : null}
        <button className={`icon${info ? ' on' : ''}`} onClick={() => setInfo(!info)} aria-label="Infos">i</button>
      </header>

      <div className="stage" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {video ? (
          <video src={video} controls autoPlay playsInline onPointerDown={(e) => e.stopPropagation()} />
        ) : src ? (
          <img src={src} alt="" draggable={false} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }} />
        ) : (
          <span className="muted">{links?.missing ? 'In OneDrive nicht gefunden' : 'Wird geladen …'}</span>
        )}
        {it.k === 'v' && !video && (
          <button className="play" onPointerDown={(e) => e.stopPropagation()} onClick={() => void loadOriginal()} aria-label="Video abspielen">▶</button>
        )}
      </div>

      {info && (
        <div className="info">
          <div className="info-row muted">{folder(it) || 'OneDrive'}</div>
          {it.w && it.h ? <div className="info-row">{it.w} × {it.h} · {((it.w * it.h) / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MP</div> : null}
          {it.m && <div className="info-row">{it.m}</div>}
          {tags.length > 0 && (
            <div className="chips">
              {tags.map((t) => (
                <span key={t.id} className="chip on">{t.group === COLLECTION ? `Sammlung: ${t.name}` : t.name}</span>
              ))}
            </div>
          )}
          {it.c && it.c.length > 0 && (
            <div className="info-colors">
              {it.c.map(([hex, tone], i) => (
                <span key={i}>
                  <i style={{ background: hex }} /> {tone}
                  {i === 0 && it.c!.length > 1 && <small className="muted"> Hauptfarbe</small>}
                </span>
              ))}
              {it.a && <small className="muted">automatisch erkannt</small>}
            </div>
          )}
          {it.k === 'i' && !demo && !sharp && /\.(jpe?g|png|webp|gif)$/i.test(it.p) && (
            <button className="btn small" onClick={() => void loadOriginal()}>Original in voller Schärfe laden</button>
          )}
        </div>
      )}
    </div>
  );
}
