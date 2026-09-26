import { fetch } from '@tauri-apps/api/http';

// The old Pot-hosted Lingva instance has been returning 404 for a long time.
// Keep a small ordered pool of public Lingva instances and fail over on
// network/HTTP errors. They all implement the same REST v1 API.
const LINGVA_INSTANCES = [
    'https://translate.dr460nf1r3.org',
    'https://lingva.garudalinux.org',
    'https://translate.jae.fi',
];

export async function translate(text, from, to) {
    const plainText = text.replaceAll('/', '@@');
    const encodedText = encodeURIComponent(plainText);
    let lastError = null;

    for (const instance of LINGVA_INSTANCES) {
        try {
            const res = await fetch(`${instance}/api/v1/${from}/${to}/${encodedText}`, {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                },
            });

            if (res.ok) {
                const result = res.data;
                if (result?.translation) {
                    return result.translation.replaceAll('@@', '/');
                }
                lastError = new Error(result?.error ?? 'Unexpected Lingva response');
                continue;
            }

            lastError = new Error(`Lingva request failed (${res.status}) via ${instance}`);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    throw lastError ?? new Error('Lingva translation failed');
}

export * from './Config';
export * from './info';
