import { fetch, Body } from '@tauri-apps/api/http';

function normalizeEndpoint(value) {
    let endpoint = (value ?? '').trim();
    if (!endpoint) endpoint = 'https://libretranslate.com';
    if (!endpoint.startsWith('http')) endpoint = 'https://' + endpoint;
    endpoint = endpoint.replace(/\/$/, '');
    return endpoint.endsWith('/translate') ? endpoint : endpoint + '/translate';
}

export async function translate(text, from, to, options = {}) {
    const config = options.config ?? {};
    const payload = {
        q: text,
        source: from || 'auto',
        target: to,
        format: 'text',
    };
    if (config.api_key?.trim()) payload.api_key = config.api_key.trim();

    const res = await fetch(normalizeEndpoint(config.custom_url), {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: Body.json(payload),
    });

    if (!res.ok) {
        const detail = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        throw new Error(`LibreTranslate failed (${res.status})\n${detail.slice(0, 220)}`);
    }

    const translated = res.data?.translatedText;
    if (!translated) throw new Error('LibreTranslate returned an unexpected response');
    return translated.trim();
}

export * from './Config';
export * from './info';
