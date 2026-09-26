import { Button, Input, Select, SelectItem } from '@nextui-org/react';
import React from 'react';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { useConfig } from '../../../hooks/useConfig';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const [config, setConfig] = useConfig(
        instanceKey,
        { [INSTANCE_NAME_CONFIG_KEY]: 'OCR.Space', api_key: '', engine: '2' },
        { sync: false }
    );

    return (
        config !== null && (
            <form className='space-y-4' onSubmit={(e) => { e.preventDefault(); setConfig(config, true); updateServiceList(instanceKey); onClose(); }}>
                <Input label='OCR.Space API key' type='password' value={config.api_key} onValueChange={(v) => setConfig({ ...config, api_key: v })} />
                <Select label='OCR engine' selectedKeys={[String(config.engine || '2')]} onSelectionChange={(keys) => setConfig({ ...config, engine: String(Array.from(keys)[0] || '2') })}>
                    <SelectItem key='1'>Engine 1 — fast</SelectItem>
                    <SelectItem key='2'>Engine 2 — balanced</SelectItem>
                    <SelectItem key='3'>Engine 3 — high accuracy</SelectItem>
                </Select>
                <Button type='submit' color='primary' fullWidth>Save</Button>
            </form>
        )
    );
}
