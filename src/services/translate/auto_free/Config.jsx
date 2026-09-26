import { Button } from '@nextui-org/react';
import React from 'react';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { useConfig } from '../../../hooks/useConfig';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const [config, setConfig] = useConfig(instanceKey, { [INSTANCE_NAME_CONFIG_KEY]: 'Auto Free' }, { sync: false });

    return (
        config !== null && (
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    setConfig(config, true);
                    updateServiceList(instanceKey);
                    onClose();
                }}
            >
                <p className='text-small text-default-500 mb-4'>
                    Automatic free fallback: Google → Bing → Yandex → Lingva. Failed providers cool down for two minutes.
                </p>
                <Button type='submit' color='primary' fullWidth>Save</Button>
            </form>
        )
    );
}
