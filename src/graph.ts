import { token } from './auth';
import { CATALOG_PATH } from './config';
import type { Catalog } from './data';

const GRAPH = 'https://graph.microsoft.com/v1.0';

/** OneDrive-Pfad für die Adresse kodieren (jedes Teilstück einzeln, „/“ bleibt). */
const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(GRAPH + url, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${await token()}` } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw Object.assign(new Error(`OneDrive antwortet mit ${res.status}`), { status: res.status, detail: text });
  }
  return res.json() as Promise<T>;
}

/** Lädt den Katalog, den die Desktop-App nach OneDrive exportiert hat. */
export async function loadCatalog(): Promise<Catalog> {
  let meta: { '@microsoft.graph.downloadUrl'?: string };
  try {
    meta = await api(`/me/drive/root:/${encodePath(CATALOG_PATH)}?select=id,@microsoft.graph.downloadUrl`);
  } catch (e) {
    if ((e as { status?: number }).status === 404) {
      throw new Error('In OneDrive liegt noch kein Katalog. Exportiere ihn in der Desktop-App über das Wolken-Symbol oben rechts.');
    }
    throw e;
  }
  const url = meta['@microsoft.graph.downloadUrl'];
  if (!url) throw new Error('Der Katalog ließ sich nicht herunterladen.');
  // Die Download-Adresse ist bereits berechtigt und wird ohne Anmeldekopf abgerufen
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Der Katalog ließ sich nicht herunterladen (${res.status}).`);
  const data = (await res.json()) as Catalog;
  if (!data || !Array.isArray(data.files) || !Array.isArray(data.tags)) throw new Error('Der Katalog hat ein unerwartetes Format.');
  if ((data.version ?? 1) < 2) throw new Error('Der Katalog stammt von einer älteren Desktop-Version. Bitte dort neu exportieren.');
  return data;
}

export interface Links {
  /** Kleines Vorschaubild für die Kachel */
  thumb?: string;
  /** Großes Vorschaubild für die Einzelansicht */
  large?: string;
  id?: string;
  /** Zeitpunkt des Abrufs – die Adressen laufen nach einiger Zeit ab */
  at: number;
  missing?: boolean;
}

const cache = new Map<string, Links>();
const MAX_AGE = 40 * 60 * 1000;

export function cached(path: string): Links | undefined {
  const hit = cache.get(path);
  return hit && Date.now() - hit.at < MAX_AGE ? hit : undefined;
}

interface BatchResponse {
  responses: { id: string; status: number; body?: { id?: string; thumbnails?: { medium?: { url: string }; large?: { url: string }; c1600x1600?: { url: string } }[] } }[];
}

/** Holt Vorschaubild-Adressen für mehrere Dateien in einem Rutsch (höchstens 20 je Anfrage). */
export async function loadLinks(paths: string[]): Promise<void> {
  const todo = [...new Set(paths)].filter((p) => !cached(p));
  for (let i = 0; i < todo.length; i += 20) {
    const part = todo.slice(i, i + 20);
    const body = {
      requests: part.map((p, n) => ({
        id: String(n),
        method: 'GET',
        url: `/me/drive/root:/${encodePath(p)}?$select=id&$expand=thumbnails($select=medium,large,c1600x1600)`,
      })),
    };
    const res = await api<BatchResponse>('/$batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    for (const r of res.responses) {
      const path = part[Number(r.id)];
      const t = r.body?.thumbnails?.[0];
      cache.set(path, {
        at: Date.now(),
        id: r.body?.id,
        thumb: t?.medium?.url,
        large: t?.c1600x1600?.url ?? t?.large?.url ?? t?.medium?.url,
        missing: r.status === 404,
      });
    }
  }
}

/** Adresse der Originaldatei (zum Abspielen von Videos und für die volle Schärfe von Bildern). */
export async function originalUrl(path: string): Promise<string | null> {
  const meta = await api<{ '@microsoft.graph.downloadUrl'?: string }>(`/me/drive/root:/${encodePath(path)}?select=id,@microsoft.graph.downloadUrl`);
  return meta['@microsoft.graph.downloadUrl'] ?? null;
}
