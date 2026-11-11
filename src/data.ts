import { COLLECTION, KREIS } from './config';

export interface Tag {
  id: number;
  group: string;
  name: string;
}

/** Eine Datei aus dem Katalog der Desktop-App (kurze Feldnamen, siehe dort). */
export interface Item {
  /** Pfad relativ zum OneDrive-Ordner, mit „/“ */
  p: string;
  k: 'i' | 'v';
  /** Aufnahmedatum „JJJJ-MM-TT hh:mm:ss“ */
  d?: string;
  w?: number;
  h?: number;
  /** Sterne 1–5 */
  r?: number;
  /** Aufnahmegerät */
  m?: string;
  /** Tag-IDs */
  t?: number[];
  /** Farben als [Hex, Farbton], Hauptfarbe zuerst */
  c?: [string, string][];
  /** Farben automatisch erkannt (nicht von Hand bestätigt) */
  a?: boolean;
}

export interface Catalog {
  version: number;
  tags: Tag[];
  files: Item[];
}

export interface Filter {
  tags: number[];
  minRating: number;
  colors: string[];
  colorMain: boolean;
  camera: string | null;
  folder: string | null;
  kind: '' | 'i' | 'v';
  search: string;
}

export const emptyFilter: Filter = { tags: [], minRating: 0, colors: [], colorMain: false, camera: null, folder: null, kind: '', search: '' };

export const name = (it: Item) => it.p.slice(it.p.lastIndexOf('/') + 1);
export const folder = (it: Item) => it.p.slice(0, Math.max(0, it.p.lastIndexOf('/')));
const RAW = new Set(['arw', 'cr2', 'cr3', 'nef', 'dng', 'orf', 'rw2', 'raf', 'pef', 'srw']);
const ext = (it: Item) => it.p.slice(it.p.lastIndexOf('.') + 1).toLowerCase();

/**
 * Bereitet den Katalog für die Anzeige vor: neueste zuerst, und RAW-Dateien, zu denen im selben
 * Ordner ein gleichnamiges JPG liegt, entfallen (das Handy kann RAW ohnehin nicht groß zeigen).
 */
export function prepare(catalog: Catalog): Item[] {
  const developed = new Set<string>();
  const stem = (it: Item) => it.p.slice(0, it.p.lastIndexOf('.')).toLowerCase();
  for (const it of catalog.files) if (!RAW.has(ext(it))) developed.add(stem(it));
  return catalog.files
    .filter((it) => !RAW.has(ext(it)) || !developed.has(stem(it)))
    .sort((a, b) => (b.d ?? '').localeCompare(a.d ?? '') || a.p.localeCompare(b.p));
}

export function matches(it: Item, f: Filter): boolean {
  if (f.kind && it.k !== f.kind) return false;
  if (f.minRating && (it.r ?? 0) < f.minRating) return false;
  if (f.camera != null && (it.m ?? '') !== f.camera) return false;
  if (f.folder != null && !(it.p.startsWith(f.folder + '/') || folder(it) === f.folder)) return false;
  if (f.tags.length && !f.tags.every((id) => it.t?.includes(id))) return false;
  if (f.colors.length) {
    const tones = (f.colorMain ? (it.c ?? []).slice(0, 1) : it.c ?? []).map((c) => c[1]);
    if (!f.colors.some((n) => tones.includes(n))) return false;
  }
  if (f.search && !it.p.toLowerCase().includes(f.search.toLowerCase())) return false;
  return true;
}

export const activeCount = (f: Filter) =>
  f.tags.length + f.colors.length + (f.minRating ? 1 : 0) + (f.camera != null ? 1 : 0) + (f.folder != null ? 1 : 0) + (f.kind ? 1 : 0) + (f.search ? 1 : 0);

/** Aufnahmetag als Überschrift. */
export function dayLabel(it: Item): string {
  if (!it.d) return 'Ohne Datum';
  const [y, m, d] = it.d.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? 'Ohne Datum' : date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

/** Auswahllisten für den Filter: Ordner (oberste zwei Ebenen), Geräte, Tags nach Gruppen, Sammlungen. */
export function facets(catalog: Catalog, items: Item[]) {
  const count = <K,>(key: (it: Item) => K | null) => {
    const m = new Map<K, number>();
    for (const it of items) {
      const k = key(it);
      if (k != null) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };
  const folders = new Map<string, number>();
  for (const it of items) {
    const parts = folder(it).split('/').filter(Boolean);
    for (let depth = 1; depth <= Math.min(3, parts.length); depth++) {
      const key = parts.slice(0, depth).join('/');
      folders.set(key, (folders.get(key) ?? 0) + 1);
    }
  }
  const tagCount = new Map<number, number>();
  for (const it of items) for (const id of it.t ?? []) tagCount.set(id, (tagCount.get(id) ?? 0) + 1);
  const used = catalog.tags.filter((t) => tagCount.has(t.id));
  const groups = new Map<string, Tag[]>();
  for (const t of used.filter((t) => t.group !== COLLECTION)) {
    if (!groups.has(t.group)) groups.set(t.group, []);
    groups.get(t.group)!.push(t);
  }
  return {
    folders: [...folders.entries()].sort((a, b) => a[0].localeCompare(b[0], 'de')),
    cameras: [...count((it) => it.m ?? null).entries()].sort((a, b) => b[1] - a[1]),
    collections: used.filter((t) => t.group === COLLECTION),
    groups: [...groups.entries()].sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0], 'de'))),
    tagCount,
    tones: new Set(items.flatMap((it) => (it.c ?? []).map((c) => c[1]))),
  };
}

// ---------- Beispieldaten (ohne Anmeldung ausprobieren) ----------

export function demoCatalog(): Catalog {
  const tags: Tag[] = [
    { id: 1, group: 'Anlass', name: 'Hochzeit' },
    { id: 2, group: 'Anlass', name: 'Trauer' },
    { id: 3, group: 'Werkstück', name: 'Brautstrauß' },
    { id: 4, group: 'Werkstück', name: 'Tischdeko' },
    { id: 5, group: COLLECTION, name: 'Homepage Frühjahr' },
    { id: 6, group: '', name: 'Portfolio' },
  ];
  const cams = ['Sony ILCE-6700', 'Apple iPhone 15 Pro', 'Sony XQ-EC54'];
  const files: Item[] = Array.from({ length: 240 }, (_, i) => {
    const id = i + 1;
    const video = id % 19 === 0;
    const portrait = id % 3 === 0;
    const tone = KREIS[(id * 5) % KREIS.length];
    const second = KREIS[(id * 3 + 4) % KREIS.length];
    const day = String(28 - Math.floor(i / 9)).padStart(2, '0');
    return {
      p: `Bilder/${id % 4 === 0 ? '2025/Hochzeit Müller' : '2026/Garten'}/${video ? 'VID' : 'IMG'}_${1000 + id}.${video ? 'mp4' : 'jpg'}`,
      k: video ? 'v' : 'i',
      d: `2026-0${1 + Math.floor(i / 60)}-${day < '01' ? '01' : day} 1${id % 10}:2${id % 6}:00`,
      w: portrait ? 4000 : 6000,
      h: portrait ? 6000 : 4000,
      r: id % 5 === 0 ? 1 + (id % 5) + (id % 4) : undefined,
      m: video ? undefined : cams[id % 3],
      t: tags.filter((t) => (id * (t.id + 1)) % 6 === 0).map((t) => t.id),
      c: video ? undefined : [[tone[1], tone[0]], [second[1], second[0]]],
      a: id % 2 === 0,
    };
  });
  return { version: 2, tags, files };
}

/** Farbiges Platzhalterbild für die Beispieldaten. */
export function demoImage(it: Item, size: number): string {
  const [a, b] = [it.c?.[0]?.[0] ?? '#6b7a6c', it.c?.[1]?.[0] ?? '#2e3a33'];
  const portrait = (it.h ?? 2) > (it.w ?? 3);
  const [w, h] = portrait ? [Math.round(size * 0.667), size] : [size, Math.round(size * 0.667)];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="#3d5a41"/>` +
    `<circle cx="${w * 0.5}" cy="${h * 0.5}" r="${Math.min(w, h) * 0.34}" fill="${a}"/>` +
    `<circle cx="${w * 0.5}" cy="${h * 0.5}" r="${Math.min(w, h) * 0.13}" fill="${b}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
