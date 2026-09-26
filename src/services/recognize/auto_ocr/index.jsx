import * as system from '../system';
import * as tesseract from '../tesseract';
import * as mistral from '../mistral';
import * as ocrspace from '../ocrspace';

function mapLanguage(service, language) {
    return language in service.Language ? service.Language[language] : null;
}

export async function recognize(base64, language, options = {}) {
    const config = options.config ?? {};
    const localRoutes = [
        { name: 'System OCR', service: system, config: {} },
        { name: 'Tesseract', service: tesseract, config: {} },
    ];
    const cloudRoutes = [];

    if (config.mistral_api_key?.trim()) {
        cloudRoutes.push({
            name: 'Mistral OCR',
            service: mistral,
            config: { api_key: config.mistral_api_key, model: config.mistral_model || 'mistral-ocr-latest' },
        });
    }
    if (config.ocrspace_api_key?.trim()) {
        cloudRoutes.push({
            name: 'OCR.Space',
            service: ocrspace,
            config: { api_key: config.ocrspace_api_key, engine: config.ocrspace_engine || '2' },
        });
    }

    const routes = config.prefer_cloud ? [...cloudRoutes, ...localRoutes] : [...localRoutes, ...cloudRoutes];
    const errors = [];

    for (const route of routes) {
        const mapped = mapLanguage(route.service, language);
        if (mapped === null) continue;
        try {
            const result = await route.service.recognize(base64, mapped, { config: route.config });
            if (result?.trim()) return result.trim();
            throw new Error('Empty response');
        } catch (error) {
            errors.push(`${route.name}: ${String(error?.message ?? error).slice(0, 180)}`);
        }
    }

    throw new Error(`All OCR providers failed\n${errors.join('\n')}`);
}

export * from './Config';
export * from './info';
