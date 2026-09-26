import { fetch, Body } from '@tauri-apps/api/http';

const TOKEN_URL = 'https://edge.microsoft.com/translate/auth';
const TRANSLATE_URL = 'https://api-edge.cognitive.microsofttranslator.com/translate';
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0';

let cachedToken = '';
let cachedTokenExpiresAt = 0;
let tokenPromise = null;

function getTokenExpiry(token) {
    try {
        const payload = token.split('.')[1];
        if (!payload) return 0;
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
        const decoded = JSON.parse(atob(padded));
        return (decoded.exp ?? 0) * 1000;
    } catch (_) {
        return 0;
    }
}

async function fetchToken() {
    const response = await fetch(TOKEN_URL, {
        method: 'GET',
        headers: { 'User-Agent': USER_AGENT },
        responseType: 2,
    });

    if (!response.ok || !response.data) {
        throw new Error(`Microsoft translator auth failed (${response.status})`);
    }

    const token = String(response.data).trim();
    cachedToken = token;
    // Edge tokens are normally valid for roughly ten minutes. Prefer the JWT
    // exp claim and keep a one-minute safety margin; use eight minutes if the
    // token format ever changes.
    const expiry = getTokenExpiry(token);
    cachedTokenExpiresAt = expiry ? expiry - 60_000 : Date.now() + 8 * 60_000;
    return token;
}

async function getToken(forceRefresh = false) {
    if (!forceRefresh && cachedToken && cachedTokenExpiresAt > Date.now()) {
        return cachedToken;
    }
    if (!tokenPromise) {
        tokenPromise = fetchToken().finally(() => {
            tokenPromise = null;
        });
    }
    return tokenPromise;
}

async function requestTranslation(text, from, to, token) {
    const query = {
        to,
        'api-version': '3.0',
        includeSentenceLength: 'true',
    };
    if (from) query.from = from;

    return fetch(TRANSLATE_URL, {
        method: 'POST',
        headers: {
            accept: '*/*',
            authorization: 'Bearer ' + token,
            'content-type': 'application/json',
            'User-Agent': USER_AGENT,
        },
        query,
        body: Body.json([{ Text: text }]),
    });
}

export async function translate(text, from, to) {
    let token = await getToken();
    let res = await requestTranslation(text, from, to, token);

    // The anonymous Edge token can occasionally be invalidated before its JWT
    // expiry. Refresh once instead of making the user retry manually.
    if (res.status === 401 || res.status === 403) {
        cachedToken = '';
        cachedTokenExpiresAt = 0;
        token = await getToken(true);
        res = await requestTranslation(text, from, to, token);
    }

    if (res.ok) {
        const result = res.data;
        const translated = result?.[0]?.translations?.[0]?.text;
        if (translated) {
            return translated.trim();
        }
        throw JSON.stringify(result);
    }

    throw `Microsoft Translate request failed (${res.status})\n${JSON.stringify(res.data).slice(0, 300)}`;
}

export * from './Config';
export * from './info';
