import { fetch, Body } from '@tauri-apps/api/http';

const GOOGLE_CLIENTS5_URL = 'https://clients5.google.com/translate_a/t';
const GOOGLE_API_HOST = 'https://translate.googleapis.com';
const LEGACY_GOOGLE_HOST = 'https://translate.google.com';
const GOOGLE_RPC_URL = 'https://translate.google.com/_/TranslateWebserverUi/data/batchexecute';
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0';

function normalizeHost(value) {
    let host = (value ?? '').trim();
    if (!host) return '';
    if (!host.startsWith('http')) host = 'https://' + host;
    return host.replace(/\/$/, '');
}

function commonHeaders() {
    return {
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': USER_AGENT,
    };
}

function browserHeaders() {
    return {
        ...commonHeaders(),
        referer: 'https://translate.google.com/',
        cookie: 'CONSENT=YES+cb',
    };
}

function parseClients5(result) {
    // With q in a form-encoded POST Google commonly returns an array such as
    // [["translation", ...]]. A single q in the query string can instead return
    // the Dictionary-extension object shape with sentences[].trans. Support both
    // so a backend response-shape change does not break the provider.
    if (result && !Array.isArray(result) && Array.isArray(result.sentences)) {
        const text = result.sentences
            .map((sentence) => sentence?.trans ?? '')
            .filter(Boolean)
            .join('')
            .trim();
        if (text) return text;
    }

    if (!Array.isArray(result) || result.length === 0) throw new Error('Unexpected Google clients5 response');
    const first = result[0];
    if (typeof first === 'string') return first.trim();
    if (Array.isArray(first) && typeof first[0] === 'string') return first[0].trim();
    if (Array.isArray(first?.[0]) && typeof first[0][0] === 'string') return first[0][0].trim();
    throw new Error('Unexpected Google clients5 response');
}

function parseSingle(result) {
    if (!Array.isArray(result) || !Array.isArray(result[0])) throw new Error('Unexpected Google Translate response');
    if (Array.isArray(result[1]) && result[1].length > 0) {
        const target = { pronunciations: [], explanations: [], associations: [], sentence: [] };
        const pronunciation = result?.[0]?.[1]?.[3];
        if (pronunciation) target.pronunciations.push({ symbol: pronunciation, voice: '' });
        for (const item of result[1]) {
            if (!item) continue;
            target.explanations.push({
                trait: item[0],
                explains: Array.isArray(item[2]) ? item[2].map((x) => x?.[0]).filter(Boolean) : [],
            });
        }
        if (Array.isArray(result?.[13]?.[0])) {
            for (const item of result[13][0]) if (item?.[0]) target.sentence.push({ source: item[0] });
        }
        return target;
    }
    return result[0]
        .map((part) => part?.[0] ?? '')
        .join('')
        .trim();
}

function compactError(res, route) {
    let detail = '';
    if (typeof res.data === 'string') detail = res.data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
    else if (res.data !== undefined && res.data !== null) detail = JSON.stringify(res.data).slice(0, 180);
    return `Google Translate request failed (${res.status}) via ${route}${detail ? `\n${detail}` : ''}`;
}

async function translateViaClients5(text, from, to) {
    const res = await fetch(GOOGLE_CLIENTS5_URL, {
        method: 'POST',
        headers: { ...commonHeaders(), 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        query: { client: 'dict-chrome-ex', sl: from || 'auto', tl: to, ie: 'UTF-8', oe: 'UTF-8' },
        body: Body.text(`q=${encodeURIComponent(text)}`),
    });
    if (!res.ok) throw new Error(compactError(res, 'clients5'));
    return parseClients5(res.data);
}

function parseRpcPayload(raw) {
    const line = String(raw)
        .split('\n')
        .map((x) => x.trim())
        .find((x) => x.startsWith('[[') && x.includes('"MkEWBc"'));
    if (!line) throw new Error('Google RPC envelope not found');
    const envelope = JSON.parse(line);
    const payload = JSON.parse(envelope?.[0]?.[2]);
    const parts = payload?.[1]?.[0]?.[0]?.[5];
    if (Array.isArray(parts)) {
        const text = parts
            .map((item) => item?.[0] ?? '')
            .filter(Boolean)
            .join(' ')
            .trim();
        if (text) return text;
    }
    const fallback = payload?.[1]?.[0]?.[0]?.[0];
    if (typeof fallback === 'string' && fallback.trim()) return fallback.trim();
    throw new Error('Unexpected Google RPC response');
}

async function translateViaRpc(text, from, to) {
    const inner = JSON.stringify([[text, from || 'auto', to, true], [null]]);
    const freq = JSON.stringify([[['MkEWBc', inner, null, 'generic']]]);
    const res = await fetch(GOOGLE_RPC_URL, {
        method: 'POST',
        headers: { ...browserHeaders(), 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        query: { rpcids: 'MkEWBc', 'soc-app': '1', 'soc-platform': '1', 'soc-device': '1', rt: 'c' },
        body: Body.text(`f.req=${encodeURIComponent(freq)}&`),
        responseType: 2,
    });
    if (!res.ok) throw new Error(compactError(res, 'batchexecute'));
    return parseRpcPayload(res.data);
}

async function translateViaSingle(host, text, from, to) {
    const res = await fetch(`${host}/translate_a/single?dt=t&dt=bd&dt=rm&dt=ex`, {
        method: 'GET',
        headers: browserHeaders(),
        query: { client: 'at', sl: from || 'auto', tl: to, hl: to, ie: 'UTF-8', oe: 'UTF-8', q: text },
    });
    if (!res.ok) throw new Error(compactError(res, host));
    return parseSingle(res.data);
}

export async function translate(text, from, to, options = {}) {
    const configured = normalizeHost(options.config?.custom_url);
    const routes = [() => translateViaClients5(text, from, to), () => translateViaRpc(text, from, to)];
    if (configured && configured !== GOOGLE_API_HOST && configured !== LEGACY_GOOGLE_HOST) {
        routes.push(() => translateViaSingle(configured, text, from, to));
    }
    routes.push(() => translateViaSingle(GOOGLE_API_HOST, text, from, to));
    routes.push(() => translateViaSingle(LEGACY_GOOGLE_HOST, text, from, to));

    let lastError = null;
    for (const route of routes) {
        try {
            return await route();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }
    throw lastError ?? new Error('Google Translate request failed');
}

export * from './Config';
export * from './info';
