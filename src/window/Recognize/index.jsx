import { readDir, BaseDirectory, readTextFile, exists } from '@tauri-apps/api/fs';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import { appWindow, currentMonitor, LogicalPosition, LogicalSize } from '@tauri-apps/api/window';
import React, { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Button } from '@nextui-org/react';
import { BsPinFill } from 'react-icons/bs';
import { atom, useAtom, useAtomValue } from 'jotai';

import WindowControl from '../../components/WindowControl';
import { store } from '../../utils/store';
import { osType } from '../../utils/env';
import { useConfig } from '../../hooks';
import ControlArea from './ControlArea';
import ImageArea from './ImageArea';
import TextArea, { textAtom } from './TextArea';
import TranslatePanel from './TranslatePanel';

export const pluginListAtom = atom();

let blurTimeout = null;

const listenBlur = () => {
    return listen('tauri://blur', () => {
        if (appWindow.label === 'recognize') {
            if (blurTimeout) {
                clearTimeout(blurTimeout);
            }
            // 50ms后关闭窗口，因为在 windows 下拖动窗口时会先切换成 blur 再立即切换成 focus
            // 如果直接关闭将导致窗口无法拖动
            blurTimeout = setTimeout(async () => {
                await appWindow.close();
            }, 50);
        }
    });
};

let unlisten = listenBlur();
// 取消 blur 监听
const unlistenBlur = () => {
    unlisten.then((f) => {
        f();
    });
};

// 监听 focus 事件取消 blurTimeout 时间之内的关闭窗口
void listen('tauri://focus', () => {
    if (blurTimeout) {
        clearTimeout(blurTimeout);
    }
});

export default function Recognize() {
    const [pluginList, setPluginList] = useAtom(pluginListAtom);
    const [closeOnBlur] = useConfig('recognize_close_on_blur', false);
    const [autoTranslate] = useConfig('recognize_auto_translate', false);
    const [pined, setPined] = useState(false);
    const [translatePanelOpen, setTranslatePanelOpen] = useState(false);
    const [serviceInstanceList] = useConfig('recognize_service_list', ['system', 'tesseract']);
    const [serviceInstanceConfigMap, setServiceInstanceConfigMap] = useState(null);
    const text = useAtomValue(textAtom);
    const baseWindowGeometryRef = useRef(null);
    const expandedRef = useRef(false);

    const loadPluginList = async () => {
        let temp = {};
        if (await exists(`plugins/recognize`, { dir: BaseDirectory.AppConfig })) {
            const plugins = await readDir(`plugins/recognize`, { dir: BaseDirectory.AppConfig });
            for (const plugin of plugins) {
                const infoStr = await readTextFile(`plugins/recognize/${plugin.name}/info.json`, {
                    dir: BaseDirectory.AppConfig,
                });
                let pluginInfo = JSON.parse(infoStr);
                if ('icon' in pluginInfo) {
                    const appConfigDirPath = await appConfigDir();
                    const iconPath = await join(
                        appConfigDirPath,
                        `/plugins/recognize/${plugin.name}/${pluginInfo.icon}`
                    );
                    pluginInfo.icon = convertFileSrc(iconPath);
                }
                temp[plugin.name] = pluginInfo;
            }
        }
        setPluginList({ ...temp });
    };
    const loadServiceInstanceConfigMap = async () => {
        const config = {};
        for (const serviceInstanceKey of serviceInstanceList) {
            config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
        }
        setServiceInstanceConfigMap({ ...config });
    };
    useEffect(() => {
        if (serviceInstanceList !== null) {
            loadServiceInstanceConfigMap();
        }
    }, [serviceInstanceList]);

    useEffect(() => {
        loadPluginList();
    }, []);
    // 是否自动关闭窗口
    useEffect(() => {
        if (closeOnBlur !== null && !closeOnBlur) {
            unlistenBlur();
        }
    }, [closeOnBlur]);

    // Auto translate means: as soon as OCR produces non-empty text, open the
    // embedded panel. TargetArea reacts to sourceTextAtom and starts translation.
    useEffect(() => {
        if (autoTranslate && text) {
            setTranslatePanelOpen(true);
        }
    }, [autoTranslate, text]);

    // Grow the native OCR window when the embedded panel opens. Preserve the
    // previous geometry and restore it when the panel closes. This keeps the OCR
    // columns at their old width instead of squeezing them to make room.
    useEffect(() => {
        const syncWindowSize = async () => {
            const monitor = await currentMonitor();
            if (!monitor) return;

            const factor = monitor.scaleFactor;
            const monitorSize = monitor.size.toLogical(factor);
            const monitorPosition = monitor.position.toLogical(factor);

            if (translatePanelOpen) {
                if (!expandedRef.current) {
                    const size = (await appWindow.outerSize()).toLogical(factor);
                    const position = (await appWindow.outerPosition()).toLogical(factor);
                    baseWindowGeometryRef.current = {
                        width: size.width,
                        height: size.height,
                        x: position.x,
                        y: position.y,
                    };
                }

                const base = baseWindowGeometryRef.current;
                if (!base) return;

                const margin = 8;
                const desiredWidth = Math.min(base.width + 420, monitorSize.width - margin * 2);
                const monitorRight = monitorPosition.x + monitorSize.width;
                const desiredX = Math.max(
                    monitorPosition.x + margin,
                    Math.min(base.x, monitorRight - desiredWidth - margin)
                );
                const desiredY = Math.max(
                    monitorPosition.y + margin,
                    Math.min(base.y, monitorPosition.y + monitorSize.height - base.height - margin)
                );

                await appWindow.setSize(new LogicalSize(desiredWidth, base.height));
                await appWindow.setPosition(new LogicalPosition(desiredX, desiredY));
                expandedRef.current = true;
            } else if (expandedRef.current && baseWindowGeometryRef.current) {
                const base = baseWindowGeometryRef.current;
                await appWindow.setSize(new LogicalSize(base.width, base.height));
                await appWindow.setPosition(new LogicalPosition(base.x, base.y));
                expandedRef.current = false;
                baseWindowGeometryRef.current = null;
            }
        };

        syncWindowSize().catch((error) => {
            console.error('Failed to resize OCR window for translation panel:', error);
        });
    }, [translatePanelOpen]);

    return (
        pluginList &&
        serviceInstanceConfigMap !== null && (
            <div
                className={`bg-background h-screen ${
                    osType === 'Linux' && 'rounded-[10px] border-1 border-default-100'
                }`}
            >
                <div
                    data-tauri-drag-region='true'
                    className='fixed top-[5px] left-[5px] right-[5px] h-[30px]'
                />
                <div className={`h-[35px] flex ${osType === 'Darwin' ? 'justify-end' : 'justify-between'}`}>
                    <Button
                        isIconOnly
                        size='sm'
                        variant='flat'
                        disableAnimation
                        className='my-auto mx-[5px] bg-transparent'
                        onPress={() => {
                            if (pined) {
                                if (closeOnBlur) {
                                    unlisten = listenBlur();
                                }
                                appWindow.setAlwaysOnTop(false);
                            } else {
                                unlistenBlur();
                                appWindow.setAlwaysOnTop(true);
                            }
                            setPined(!pined);
                        }}
                    >
                        <BsPinFill className={`text-[20px] ${pined ? 'text-primary' : 'text-default-400'}`} />
                    </Button>
                    {osType !== 'Darwin' && <WindowControl />}
                </div>

                <div className='h-[calc(100vh-35px)] flex overflow-hidden'>
                    <div className='flex-1 min-w-0 h-full flex flex-col'>
                        <div className='flex-1 min-h-0 grid grid-cols-2'>
                            <ImageArea />
                            <TextArea serviceInstanceConfigMap={serviceInstanceConfigMap} />
                        </div>
                        <div className='h-[50px] shrink-0'>
                            <ControlArea
                                serviceInstanceList={serviceInstanceList}
                                serviceInstanceConfigMap={serviceInstanceConfigMap}
                                onTranslate={() => setTranslatePanelOpen(true)}
                            />
                        </div>
                    </div>

                    <div
                        className={`h-full shrink-0 overflow-hidden transition-[width,opacity] duration-200 ease-out ${
                            translatePanelOpen ? 'w-[420px] opacity-100' : 'w-0 opacity-0'
                        }`}
                    >
                        {translatePanelOpen && (
                            <TranslatePanel
                                text={text}
                                onClose={() => setTranslatePanelOpen(false)}
                            />
                        )}
                    </div>
                </div>
            </div>
        )
    );
}
