import { fetch } from '@tauri-apps/api/http';

const GOOGLE_API_HOST = 'https://translate.googleapis.com';
const LEGACY_GOOGLE_HOST = 'https://translate.google.com';

function normalizeHost(value) {
    let host = (value ?? '').trim();
    if (!host) return '';
    if (!host.startsWith('http')) {
        host = 'https://' + host;
    }
    return host.replace(/\/$/, '');
}

function getHosts(config = {}) {
    const configured = normalizeHost(config.custom_url);

    // translate.google.com increasingly answers desktop/non-browser clients with
    // the Web Search "automated queries" 429 page. Prefer the gtx endpoint on
    // translate.googleapis.com, but retain the legacy host as a final fallback.
    // A user-supplied custom host remains first so existing proxy setups keep
    // working, while old/default Pot configs migrate transparently.
    if (!configured || configured === LEGACY_GOOGLE_HOST || configured === GOOGLE_API_HOST) {
        return [GOOGLE_API_HOST, LEGACY_GOOGLE_HOST];
    }

    return [...new Set([configured, GOOGLE_API_HOST, LEGACY_GOOGLE_HOST])];
}

function parseResult(result) {
    if (!Array.isArray(result) || !Array.isArray(result[0])) {
        throw new Error('Unexpected Google Translate response');
    }

    // Dictionary mode.
    if (Array.isArray(result[1]) && result[1].length > 0) {
        const target = { pronunciations: [], explanations: [], associations: [], sentence: [] };
        const pronunciation = result?.[0]?.[1]?.[3];
        if (pronunciation) {
            target.pronunciations.push({ symbol: pronunciation, voice: '' });
        }
        for (const item of result[1]) {
            if (!item) continue;
            target.explanations.push({
                trait: item[0],
                explains: Array.isArray(item[2]) ? item[2].map((x) => x?.[0]).filter(Boolean) : [],
            });
        }
        if (Array.isArray(result?.[13]?.[0])) {
            for (const item of result[13][0]) {
                if (item?.[0]) target.sentence.push({ source: item[0] });
            }
        }
        return target;
    }

    return result[0]
        .map((part) => part?.[0] ?? '')
        .join('')
        .trim();
}

function compactError(res, host) {
    let detail = '';
    if (typeof res.data === 'string') {
        // Do not dump Google's multi-kilobyte "Sorry..." HTML into the UI.
        detail = res.data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
    } else if (res.data !== undefined && res.data !== null) {
        detail = JSON.stringify(res.data).slice(0, 240);
    }
    return `Google Translate request failed (${res.status}) via ${host}${detail ? `\n${detail}` : ''}`;
}

export async function translate(text, from, to, options = {}) {
    const hosts = getHosts(options.config ?? {});
    let lastError = null;

    for (const host of hosts) {
        try {
            // Request the small set of metadata used by Pot's dictionary UI in
            // addition to the translated text. Keeping repeated dt parameters
            // in the URL avoids them being flattened by Tauri's query object.
            const res = await fetch(`${host}/translate_a/single?dt=t&dt=bd&dt=rm&dt=ex`, {
                method: 'GET',
                headers: {
                    accept: 'application/json,text/plain,*/*',
                    'accept-language': 'en-US,en;q=0.9',
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                },
                query: {
                    client: 'gtx',
                    sl: from,
                    tl: to,
                    hl: to,
                    ie: 'UTF-8',
                    oe: 'UTF-8',
                    q: text,
                },
            });

            if (res.ok) {
                return parseResult(res.data);
            }

            lastError = new Error(compactError(res, host));
            // Continue to the next host for any endpoint-specific failure rather
            // than surfacing the first HTML interstitial or regional block.
            continue;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    throw lastError ?? new Error('Google Translate request failed');
}

export * from './Config';
export * from './info';
