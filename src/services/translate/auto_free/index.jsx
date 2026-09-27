import * as google from '../google';
import * as bing from '../bing';
import * as yandex from '../yandex';
import * as lingva from '../lingva';

const COOLDOWN_MS = 2 * 60 * 1000;
const cooldownUntil = new Map();

const providers = [
    { name: 'Google', service: google },
    { name: 'Bing', service: bing },
    { name: 'Yandex', service: yandex },
    { name: 'Lingva', service: lingva },
];

function mappedLanguage(service, language) {
    return language in service.Language ? service.Language[language] : null;
}

function prepareProvider(provider, from, to) {
    const source = mappedLanguage(provider.service, from);
    const target = mappedLanguage(provider.service, to);
    if (source === null || target === null) return null;
    return { ...provider, source, target };
}

async function runProvider(provider, text, options) {
    return provider.service.translate(text, provider.source, provider.target, {
        config: {},
        detect: options.detect,
        setResult: options.setResult,
    });
}

export async function translate(text, from, to, options = {}) {
    const compatible = providers.map((provider) => prepareProvider(provider, from, to)).filter(Boolean);
    if (compatible.length === 0) {
        throw new Error(`No free translator supports ${from} → ${to}`);
    }

    const now = Date.now();
    let routes = compatible.filter((provider) => (cooldownUntil.get(provider.name) ?? 0) <= now);

    // If every compatible provider is cooling down, retry only the provider
    // whose cooldown expires first instead of hammering the whole chain again.
    if (routes.length === 0) {
        routes = [
            compatible.reduce((earliest, provider) =>
                (cooldownUntil.get(provider.name) ?? 0) < (cooldownUntil.get(earliest.name) ?? 0)
                    ? provider
                    : earliest
            ),
        ];
    }

    const errors = [];
    for (const provider of routes) {
        try {
            const result = await runProvider(provider, text, options);
            cooldownUntil.delete(provider.name);
            if (result !== undefined && result !== null && result !== '') return result;
            throw new Error('Empty response');
        } catch (error) {
            cooldownUntil.set(provider.name, Date.now() + COOLDOWN_MS);
            errors.push(`${provider.name}: ${String(error?.message ?? error).slice(0, 180)}`);
        }
    }

    throw new Error(`All available free translators failed\n${errors.join('\n')}`);
}

export * from './Config';
export * from './info';
