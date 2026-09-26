import { fetch, Body } from '@tauri-apps/api/http';
import { v4 as uuidv4 } from 'uuid';

const DEEPL_ONESHOT_URL = 'https://oneshot-free.www.deepl.com/v1/translate';
const DEEPL_APP_VERSION = '26.42';
const DEEPL_APP_BUILD = '5443737';
const DEEPL_OS_VERSION = '26.0';
const deeplInstanceId = uuidv4().toLowerCase();
const deeplSessionId = uuidv4().toLowerCase();

export async function translate(text, from, to, options = {}) {
    const { config } = options;

    const serviceType = config['type'];
    if (serviceType === 'free') {
        return translate_by_free(text, from, to);
    } else if (serviceType === 'api') {
        return translate_by_key(text, from, to, config.authKey);
    } else if (serviceType === 'deeplx') {
        return translate_by_deeplx(text, from, to, config.customUrl);
    } else {
        return translate_by_free(text, from, to);
    }
}

function oneshotLanguageCode(language, isTarget = false) {
    const normalized = language.toLowerCase();
    switch (normalized) {
        case 'zh':
        case 'zh-cn':
            return 'zh-Hans';
        case 'zh-tw':
            return 'zh-Hant';
        case 'pt-pt':
            return 'pt-PT';
        case 'pt-br':
            return 'pt-BR';
        case 'en':
            return isTarget ? 'en-US' : 'en';
        default:
            return normalized;
    }
}

async function translate_by_free(text, from, to) {
    const body = {
        text: [text],
        target_lang: oneshotLanguageCode(to, true),
        usage_type: 'translate',
        app_information: {
            os: 'iOS',
            os_version: DEEPL_OS_VERSION,
            app_version: DEEPL_APP_VERSION,
            app_build: DEEPL_APP_BUILD,
            instance_id: deeplInstanceId,
        },
    };
    if (from !== 'auto') {
        body.source_lang = oneshotLanguageCode(from, false);
    }

    const res = await fetch(DEEPL_ONESHOT_URL, {
        method: 'POST',
        body: Body.json(body),
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'None',
            'User-Agent': 'DeepL/26.42 CFNetwork/3826.600.41 Darwin/25.0.0',
            'x-app-os-version': DEEPL_OS_VERSION,
            'x-app-instance-id': deeplInstanceId,
            'x-app-session-id': deeplSessionId,
        },
    });

    if (res.ok) {
        const translated = res.data?.translations?.[0]?.text;
        if (translated) {
            return translated.trim();
        }
        throw JSON.stringify(res.data);
    }

    const message = res.data?.message ?? res.data?.title ?? res.data?.error;
    throw `DeepL request failed (${res.status})${message ? `\n${message}` : ''}`;
}

async function translate_by_deeplx(text, from, to, url) {
    let res = await fetch(url, {
        method: 'POST',
        body: Body.json({
            source_lang: from,
            target_lang: to,
            text: text,
        }),
    });

    if (res.ok) {
        const result = res.data;
        if (result['data']) {
            return result['data'];
        } else {
            throw JSON.stringify(result);
        }
    } else {
        throw `Http Request Error\nHttp Status: ${res.status}\n${JSON.stringify(res.data)}`;
    }
}

async function translate_by_key(text, from, to, key) {
    const headers = {
        'Content-Type': 'application/json',
        Authorization: `DeepL-Auth-Key ${key}`,
    };
    let body = {
        text: [text],
        target_lang: to,
    };
    if (from !== 'auto') {
        body['source_lang'] = from;
    }
    let url;
    if (key.endsWith(':fx')) {
        url = 'https://api-free.deepl.com/v2/translate';
    } else if (key.endsWith(':dp')) {
        url = 'https://api.deepl-pro.com/v2/translate';
    } else {
        url = 'https://api.deepl.com/v2/translate';
    }
    let res = await fetch(url, {
        method: 'POST',
        body: Body.json(body),
        headers: headers,
    });

    if (res.ok) {
        const result = res.data;
        if (result.translations && result.translations[0]) {
            return result.translations[0].text.trim();
        } else {
            throw JSON.stringify(result);
        }
    } else {
        if (res.data.error) {
            throw `Status Code: ${res.status}\n${res.data.error.message}`;
        } else {
            throw `Http Request Error\nHttp Status: ${res.status}\n${JSON.stringify(res.data)}`;
        }
    }
}

export * from './Config';
export * from './info';
