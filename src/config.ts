/**
 * Anwendungs-ID (Client-ID) der App-Registrierung bei Microsoft. Sie ist kein Geheimnis: sie sagt
 * Microsoft nur, welche App sich anmelden möchte. Ist hier nichts eingetragen, fragt die App beim
 * ersten Start danach und merkt sie sich auf dem Gerät.
 */
export const DEFAULT_CLIENT_ID = '';

/** Wo die Desktop-App den Katalog in OneDrive ablegt. */
export const CATALOG_PATH = 'Apps/MaxGallerie/katalog.json';

/** Nur Lesen: Die Handy-App kann in OneDrive nichts ändern oder löschen. */
export const SCOPES = ['Files.Read'];

/** Tag-Gruppe, deren Tags Sammlungen sind (wie in der Desktop-App). */
export const COLLECTION = 'Sammlung';

/** Farbtöne des Farbsterns nach Itten, dazu Weiß. */
export const KREIS: [string, string][] = [
  ['Weiß', '#f4f1e8'],
  ['Gelb', '#f9e927'],
  ['Gelborange', '#fcc110'],
  ['Orange', '#f49422'],
  ['Rotorange', '#ec6625'],
  ['Rot', '#e52528'],
  ['Rotviolett', '#952d62'],
  ['Violett', '#6d398c'],
  ['Blauviolett', '#434e99'],
  ['Blau', '#0a72b9'],
  ['Blaugrün', '#00a99e'],
  ['Grün', '#0ba650'],
  ['Gelbgrün', '#8ec044'],
];

export function clientId(): string {
  return DEFAULT_CLIENT_ID || localStorage.getItem('clientId') || '';
}
