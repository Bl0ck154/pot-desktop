import { fetch, Body } from '@tauri-apps/api/http';

const TRANSLATE_URL = 'https://edge.microsoft.com/translate/translatetext';
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0';

function normalizeLanguage(language, isTarget = false) {
    const value = (language ?? '').trim();
    if (!value || value.toLowerCase() === 'auto') {
        return isTarget ? value : '';
    }

    switch (value.toLowerCase()) {
        case 'zh':
        case 'zh-cn':
            return 'zh-Hans';
        case 'zh-tw':
            return 'zh-Hant';
        default:
            return value;
    }
}

function compactError(res) {
    let detail = '';
    if (typeof res.data === 'string') {
        detail = res.data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220);
    } else if (res.data !== undefined && res.data !== null) {
        detail = JSON.stringify(res.data).slice(0, 220);
    }
    return `Microsoft Translate request failed (${res.status})${detail ? `\n${detail}` : ''}`;
}

export async function translate(text, from, to) {
    // Microsoft retired edge.microsoft.com/translate/auth in July 2026. The
    // replacement Edge web-translation endpoint is keyless and expects a bare
    // JSON array of strings rather than the old [{ Text }] Azure body.
    const res = await fetch(TRANSLATE_URL, {
        method: 'POST',
        headers: {
            accept: 'application/json,text/plain,*/*',
            'content-type': 'application/json',
            'User-Agent': USER_AGENT,
        },
        query: {
            from: normalizeLanguage(from, false),
            to: normalizeLanguage(to, true),
            isEnterpriseClient: 'false',
        },
        body: Body.json([text]),
    });

    if (!res.ok) {
        throw new Error(compactError(res));
    }

    const translated = res.data?.[0]?.translations?.[0]?.text;
    if (!translated) {
        throw new Error(`Microsoft Translate returned an unexpected response\n${JSON.stringify(res.data).slice(0, 220)}`);
    }

    return translated.trim();
}

export * from './Config';
export * from './info';
