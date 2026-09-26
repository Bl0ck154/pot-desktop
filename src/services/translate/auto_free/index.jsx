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

async function runProvider(provider, text, from, to, options) {
    const source = mappedLanguage(provider.service, from);
    const target = mappedLanguage(provider.service, to);
    if (source === null || target === null) {
        throw new Error('Language not supported');
    }

    return provider.service.translate(text, source, target, {
        config: {},
        detect: options.detect,
        setResult: options.setResult,
    });
}

export async function translate(text, from, to, options = {}) {
    const now = Date.now();
    let routes = providers.filter((provider) => (cooldownUntil.get(provider.name) ?? 0) <= now);
    if (routes.length === 0) routes = providers;

    const errors = [];
    for (const provider of routes) {
        try {
            const result = await runProvider(provider, text, from, to, options);
            cooldownUntil.delete(provider.name);
            if (result !== undefined && result !== null && result !== '') return result;
            throw new Error('Empty response');
        } catch (error) {
            cooldownUntil.set(provider.name, Date.now() + COOLDOWN_MS);
            errors.push(`${provider.name}: ${String(error?.message ?? error).slice(0, 180)}`);
        }
    }

    throw new Error(`All free translators failed\n${errors.join('\n')}`);
}

export * from './Config';
export * from './info';
