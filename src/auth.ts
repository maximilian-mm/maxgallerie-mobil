import { InteractionRequiredAuthError, PublicClientApplication, type AccountInfo } from '@azure/msal-browser';
import { clientId, SCOPES } from './config';

let app: PublicClientApplication | null = null;

/** Adresse dieser App ohne Zusätze – sie muss bei der Microsoft-Registrierung eingetragen sein. */
export function redirectUri(): string {
  return location.origin + location.pathname;
}

async function client(): Promise<PublicClientApplication> {
  if (app) return app;
  const created = new PublicClientApplication({
    auth: {
      clientId: clientId(),
      // „common“: private Microsoft-Konten und Geschäftskonten
      authority: 'https://login.microsoftonline.com/common',
      redirectUri: redirectUri(),
    },
    cache: { cacheLocation: 'localStorage' },
  });
  await created.initialize();
  app = created;
  return created;
}

/** Beim Start aufrufen: schließt eine laufende Anmeldung ab und liefert das angemeldete Konto. */
export async function currentAccount(): Promise<AccountInfo | null> {
  const pca = await client();
  const result = await pca.handleRedirectPromise();
  const account = result?.account ?? pca.getActiveAccount() ?? pca.getAllAccounts()[0] ?? null;
  if (account) pca.setActiveAccount(account);
  return account;
}

/** Leitet zur Microsoft-Anmeldung weiter; danach lädt die App neu. */
export async function login(): Promise<void> {
  const pca = await client();
  await pca.loginRedirect({ scopes: SCOPES, prompt: 'select_account' });
}

export async function logout(): Promise<void> {
  const pca = await client();
  const account = pca.getActiveAccount();
  // Nur diese App abmelden, nicht das Microsoft-Konto im Browser
  await pca.clearCache({ account: account ?? undefined });
  location.reload();
}

/** Zugriffstoken für Microsoft Graph; erneuert sich still, sonst erneute Anmeldung. */
export async function token(): Promise<string> {
  const pca = await client();
  const account = pca.getActiveAccount();
  if (!account) throw new Error('Nicht angemeldet');
  try {
    return (await pca.acquireTokenSilent({ scopes: SCOPES, account })).accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      await pca.acquireTokenRedirect({ scopes: SCOPES, account });
    }
    throw e;
  }
}
