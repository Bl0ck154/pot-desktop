import { Button, Divider } from '@nextui-org/react';
import { appConfigDir, appLogDir } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/api/shell';
import { invoke } from '@tauri-apps/api';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { appVersion } from '../../../../utils/env';

const REPOSITORY_URL = 'https://github.com/Bl0ck154/pot-desktop';

export default function About() {
    const { t } = useTranslation();

    return (
        <div className='h-full w-full py-[80px] px-[100px]'>
            <img
                src='icon.png'
                className='mx-auto h-[100px] mb-[5px]'
                draggable={false}
            />
            <div className='content-center'>
                <h1 className='font-bold text-2xl text-center'>Pot Bl0ck</h1>
                <p className='text-center text-sm text-gray-500 mb-[5px]'>{appVersion}</p>
                <Divider />

                <div className='grid grid-cols-3 gap-3 my-[5px]'>
                    <Button
                        variant='light'
                        size='sm'
                        onPress={() => open(REPOSITORY_URL)}
                    >
                        {t('config.about.github')}
                    </Button>
                    <Button
                        variant='light'
                        size='sm'
                        onPress={() => open(`${REPOSITORY_URL}/releases`)}
                    >
                        Releases
                    </Button>
                    <Button
                        variant='light'
                        size='sm'
                        onPress={() => open(`${REPOSITORY_URL}/issues`)}
                    >
                        {t('config.about.issue')}
                    </Button>
                </div>

                <Divider />
            </div>

            <div className='content-center px-[40px]'>
                <div className='flex justify-between'>
                    <Button
                        variant='light'
                        className='my-[5px]'
                        size='sm'
                        onPress={() => {
                            invoke('updater_window');
                        }}
                    >
                        {t('config.about.check_update')}
                    </Button>
                    <Button
                        variant='light'
                        className='my-[5px]'
                        size='sm'
                        onPress={async () => {
                            const dir = await appLogDir();
                            open(dir);
                        }}
                    >
                        {t('config.about.view_log')}
                    </Button>
                    <Button
                        variant='light'
                        className='my-[5px]'
                        size='sm'
                        onPress={async () => {
                            const dir = await appConfigDir();
                            open(dir);
                        }}
                    >
                        {t('config.about.view_config')}
                    </Button>
                </div>
                <Divider />
            </div>
        </div>
    );
}
