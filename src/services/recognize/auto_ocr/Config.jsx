import { Button, Input, Switch } from '@nextui-org/react';
import React from 'react';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { useConfig } from '../../../hooks/useConfig';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: 'Auto OCR',
            prefer_cloud: false,
            mistral_api_key: '',
            mistral_model: 'mistral-ocr-latest',
            ocrspace_api_key: '',
            ocrspace_engine: '2',
        },
        { sync: false }
    );

    return (
        config !== null && (
            <form className='space-y-4' onSubmit={(e) => { e.preventDefault(); setConfig(config, true); updateServiceList(instanceKey); onClose(); }}>
                <p className='text-small text-default-500'>Uses the already bundled System OCR/Tesseract first. Add cloud keys for extra fallbacks; no extra local OCR model is bundled.</p>
                <Switch isSelected={Boolean(config.prefer_cloud)} onValueChange={(v) => setConfig({ ...config, prefer_cloud: v })}>Prefer cloud OCR</Switch>
                <Input label='Mistral API key (optional)' type='password' value={config.mistral_api_key} onValueChange={(v) => setConfig({ ...config, mistral_api_key: v })} />
                <Input label='OCR.Space API key (optional)' type='password' value={config.ocrspace_api_key} onValueChange={(v) => setConfig({ ...config, ocrspace_api_key: v })} />
                <Button type='submit' color='primary' fullWidth>Save</Button>
            </form>
        )
    );
}
