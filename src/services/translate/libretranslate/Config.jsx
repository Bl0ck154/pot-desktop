import { Button, Input } from '@nextui-org/react';
import React from 'react';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { useConfig } from '../../../hooks/useConfig';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const [config, setConfig] = useConfig(
        instanceKey,
        { [INSTANCE_NAME_CONFIG_KEY]: 'LibreTranslate', custom_url: 'https://libretranslate.com', api_key: '' },
        { sync: false }
    );

    return (
        config !== null && (
            <form
                className='space-y-4'
                onSubmit={(e) => {
                    e.preventDefault();
                    setConfig(config, true);
                    updateServiceList(instanceKey);
                    onClose();
                }}
            >
                <p className='text-small text-default-500'>
                    libretranslate.com currently requires an API key because of bot abuse. A key may be optional on your own/self-hosted LibreTranslate endpoint.
                </p>
                <Input
                    label='Endpoint'
                    value={config.custom_url}
                    onValueChange={(v) => setConfig({ ...config, custom_url: v })}
                />
                <Input
                    label='API key'
                    type='password'
                    value={config.api_key}
                    onValueChange={(v) => setConfig({ ...config, api_key: v })}
                    description='Required by libretranslate.com; may be optional for self-hosted instances.'
                />
                <Button type='submit' color='primary' fullWidth>
                    Save
                </Button>
            </form>
        )
    );
}
