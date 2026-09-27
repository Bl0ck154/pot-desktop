import { fetch, Body } from '@tauri-apps/api/http';

const FREE_ENDPOINT_MAX_BYTES = 1024 * 1024;

function approximateDecodedBytes(base64) {
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export async function recognize(base64, language, options = {}) {
    const config = options.config ?? {};
    const apiKey = config.api_key?.trim();
    if (!apiKey) throw new Error('OCR.Space API key is required');

    let engine = ['1', '2', '3'].includes(String(config.engine)) ? String(config.engine) : '2';
    const requestedLanguage = language || 'auto';

    // OCR.Space language auto-detection is supported only by Engines 2/3.
    // Preserve the user's auto-detect intent instead of sending an invalid
    // Engine 1 + language=auto request.
    if (requestedLanguage === 'auto' && engine === '1') engine = '2';

    const approximateBytes = approximateDecodedBytes(base64);
    if (approximateBytes > FREE_ENDPOINT_MAX_BYTES) {
        throw new Error(
            `OCR.Space free endpoint accepts files up to 1 MB (image is about ${(approximateBytes / 1024 / 1024).toFixed(2)} MB). Crop a smaller area or use System/Mistral OCR.`
        );
    }

    const body = [
        ['base64Image', `data:image/png;base64,${base64}`],
        ['language', requestedLanguage],
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

    const text = (data?.ParsedResults ?? [])
        .map((item) => item?.ParsedText ?? '')
        .filter(Boolean)
        .join('\n')
        .trim();
    if (!text) throw new Error('OCR.Space returned no text');
    return text;
}

export * from './Config';
export * from './info';
