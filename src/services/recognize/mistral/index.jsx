import { fetch, Body } from '@tauri-apps/api/http';

export async function recognize(base64, _language, options = {}) {
    const config = options.config ?? {};
    const apiKey = config.api_key?.trim();
    if (!apiKey) throw new Error('Mistral OCR API key is required');

    const res = await fetch('https://api.mistral.ai/v1/ocr', {
        method: 'POST',
        headers: {
            accept: 'application/json',
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
        },
        body: Body.json({
            model: config.model?.trim() || 'mistral-ocr-latest',
            document: {
                type: 'image_url',
                image_url: `data:image/png;base64,${base64}`,
            },
            include_image_base64: false,
            include_blocks: false,
        }),
    });

    if (!res.ok) {
        const detail = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        throw new Error(`Mistral OCR failed (${res.status})\n${detail.slice(0, 240)}`);
    }

    const text = (res.data?.pages ?? []).map((page) => page?.markdown ?? '').filter(Boolean).join('\n').trim();
    if (!text) throw new Error('Mistral OCR returned no text');
    return text;
}

export * from './Config';
export * from './info';
