import { BaseDirectory, exists, readDir, readTextFile } from '@tauri-apps/api/fs';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import { writeText } from '@tauri-apps/api/clipboard';
import { Button, Card, CardBody, CardFooter, Spacer, Tooltip } from '@nextui-org/react';
import { useAtom, useSetAtom } from 'jotai';
import React, { useEffect, useState } from 'react';
import { MdClose, MdContentCopy } from 'react-icons/md';
import { useTranslation } from 'react-i18next';

import { useConfig } from '../../../hooks';
import { store } from '../../../utils/store';
import detect from '../../../utils/lang_detect';
import LanguageArea from '../../Translate/components/LanguageArea';
import TargetArea from '../../Translate/components/TargetArea';
import { detectLanguageAtom, sourceTextAtom } from '../../Translate/components/SourceArea';

export default function TranslatePanel({ text, onClose }) {
    const [translateServiceInstanceList] = useConfig('translate_service_list', [
        'deepl',
        'bing',
        'lingva',
        'yandex',
        'google',
        'ecdict',
    ]);
    const [ttsServiceInstanceList] = useConfig('tts_service_list', ['lingva_tts']);
    const [collectionServiceInstanceList] = useConfig('collection_service_list', []);
    const [sourceText, setSourceText] = useAtom(sourceTextAtom);
    const setDetectLanguage = useSetAtom(detectLanguageAtom);
    const [pluginList, setPluginList] = useState(null);
    const [serviceInstanceConfigMap, setServiceInstanceConfigMap] = useState(null);
    const { t } = useTranslation();

    useEffect(() => {
        let cancelled = false;
        const normalized = (text ?? '').trim();
        setSourceText(normalized);
        setDetectLanguage('');

        if (normalized) {
            detect(normalized).then((language) => {
                if (!cancelled) setDetectLanguage(language);
            });
        }

        return () => {
            cancelled = true;
        };
    }, [text]);

    useEffect(() => {
        const loadPluginList = async () => {
            const result = { translate: {} };
            if (await exists('plugins/translate', { dir: BaseDirectory.AppConfig })) {
                const plugins = await readDir('plugins/translate', { dir: BaseDirectory.AppConfig });
                for (const plugin of plugins) {
                    const infoStr = await readTextFile(`plugins/translate/${plugin.name}/info.json`, {
                        dir: BaseDirectory.AppConfig,
                    });
                    const pluginInfo = JSON.parse(infoStr);
                    if ('icon' in pluginInfo) {
                        const appConfigDirPath = await appConfigDir();
                        const iconPath = await join(
                            appConfigDirPath,
                            `/plugins/translate/${plugin.name}/${pluginInfo.icon}`
                        );
                        pluginInfo.icon = convertFileSrc(iconPath);
                    }
                    result.translate[plugin.name] = pluginInfo;
                }
            }
            setPluginList(result);
        };

        loadPluginList();
    }, []);

    useEffect(() => {
        if (
            translateServiceInstanceList === null ||
            ttsServiceInstanceList === null ||
            collectionServiceInstanceList === null
        ) {
            return;
        }

        const loadConfig = async () => {
            const config = {};
            const instanceKeys = [
                ...new Set([
                    ...translateServiceInstanceList,
                    ...ttsServiceInstanceList,
                    ...collectionServiceInstanceList,
                ]),
            ];
            for (const instanceKey of instanceKeys) {
                config[instanceKey] = (await store.get(instanceKey)) ?? {};
            }
            setServiceInstanceConfigMap(config);
        };

        loadConfig();
    }, [translateServiceInstanceList, ttsServiceInstanceList, collectionServiceInstanceList]);

    return (
        <div className='h-full min-w-[390px] w-[420px] border-l-1 border-default-100 bg-background p-[8px] pt-0 overflow-hidden'>
            <div className='h-[38px] flex items-center justify-between px-[4px]'>
                <div className='text-small font-medium'>{t('recognize.translate')}</div>
                <Button
                    isIconOnly
                    size='sm'
                    variant='light'
                    onPress={onClose}
                >
                    <MdClose className='text-[20px] text-default-500' />
                </Button>
            </div>

            <div className='h-[calc(100%-38px)] overflow-y-auto pr-[2px]'>
                <Card
                    shadow='none'
                    className='bg-content1 rounded-[10px]'
                >
                    <CardBody className='p-[12px] pb-0'>
                        <textarea
                            readOnly
                            value={sourceText}
                            className='min-h-[72px] max-h-[150px] w-full resize-none bg-transparent select-text outline-none'
                        />
                    </CardBody>
                    <CardFooter className='py-[4px] px-[8px]'>
                        <Tooltip content={t('translate.copy')}>
                            <Button
                                isIconOnly
                                size='sm'
                                variant='light'
                                isDisabled={!sourceText}
                                onPress={() => writeText(sourceText)}
                            >
                                <MdContentCopy className='text-[16px]' />
                            </Button>
                        </Tooltip>
                    </CardFooter>
                </Card>

                <Spacer y={2} />
                <LanguageArea />
                <Spacer y={2} />

                {pluginList !== null &&
                    serviceInstanceConfigMap !== null &&
                    translateServiceInstanceList !== null &&
                    translateServiceInstanceList.map((serviceInstanceKey, index) => {
                        const config = serviceInstanceConfigMap[serviceInstanceKey] ?? {};
                        const enabled = config.enable ?? true;
                        if (!enabled) return null;

                        return (
                            <React.Fragment key={serviceInstanceKey}>
                                <TargetArea
                                    index={index}
                                    name={serviceInstanceKey}
                                    translateServiceInstanceList={translateServiceInstanceList}
                                    pluginList={pluginList}
                                    serviceInstanceConfigMap={serviceInstanceConfigMap}
                                />
                                <Spacer y={2} />
                            </React.Fragment>
                        );
                    })}
            </div>
        </div>
    );
}
