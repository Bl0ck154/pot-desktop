import { Button, Input } from '@nextui-org/react';
import React from 'react';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { useConfig } from '../../../hooks/useConfig';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const [config, setConfig] = useConfig(
        instanceKey,
        { [INSTANCE_NAME_CONFIG_KEY]: 'Mistral OCR', api_key: '', model: 'mistral-ocr-latest' },
        { sync: false }
    );

    return (
        config !== null && (
            <form className='space-y-4' onSubmit={(e) => { e.preventDefault(); setConfig(config, true); updateServiceList(instanceKey); onClose(); }}>
                <Input label='Mistral API key' type='password' value={config.api_key} onValueChange={(v) => setConfig({ ...config, api_key: v })} />
                <Input label='Model' value={config.model} onValueChange={(v) => setConfig({ ...config, model: v })} />
                <Button type='submit' color='primary' fullWidth>Save</Button>
            </form>
        )
    );
}
