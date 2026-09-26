import { fetch, Body } from '@tauri-apps/api/http';

export async function recognize(base64, language, options = {}) {
    const config = options.config ?? {};
    const apiKey = config.api_key?.trim();
    if (!apiKey) throw new Error('OCR.Space API key is required');

    const engine = ['1', '2', '3'].includes(String(config.engine)) ? String(config.engine) : '2';
    const body = [
        ['base64Image', `data:image/png;base64,${base64}`],
        ['language', language || 'auto'],
        ['isOverlayRequired', 'false'],
        ['detectOrientation', 'true'],
        ['scale', 'true'],
        ['OCREngine', engine],
    ]
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');

    const res = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
            accept: 'application/json',
            apikey: apiKey,
            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: Body.text(body),
    });

    if (!res.ok) {
        const detail = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        throw new Error(`OCR.Space failed (${res.status})\n${detail.slice(0, 240)}`);
    }

    const data = res.data;
    if (data?.IsErroredOnProcessing) {
        const error = Array.isArray(data.ErrorMessage) ? data.ErrorMessage.join('; ') : data.ErrorMessage;
        throw new Error(`OCR.Space: ${error || 'processing failed'}`);
    }

    const text = (data?.ParsedResults ?? []).map((item) => item?.ParsedText ?? '').filter(Boolean).join('\n').trim();
    if (!text) throw new Error('OCR.Space returned no text');
    return text;
}

export * from './Config';
export * from './info';
