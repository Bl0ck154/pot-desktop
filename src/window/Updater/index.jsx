import { Button, Card, CardBody, Code, Progress, Skeleton } from '@nextui-org/react';
import React, { useEffect, useMemo, useState } from 'react';
import { appWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api';
import { open } from '@tauri-apps/api/shell';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';

import { useConfig, useToastStyle } from '../../hooks';
import { osType } from '../../utils/env';

export default function Updater() {
    const [transparent] = useConfig('transparent', true);
    const [downloaded, setDownloaded] = useState(0);
    const [total, setTotal] = useState(0);
    const [updateInfo, setUpdateInfo] = useState(null);
    const [body, setBody] = useState('');
    const [checking, setChecking] = useState(true);
    const [installing, setInstalling] = useState(false);
    const { t } = useTranslation();
    const toastStyle = useToastStyle();

    const progress = useMemo(() => {
        if (!total) return 0;
        return Math.min(100, (downloaded / total) * 100);
    }, [downloaded, total]);

    useEffect(() => {
        if (appWindow.label === 'updater') {
            appWindow.show();
        }

        let disposeProgress = null;

        listen('bl0ck://update-download-progress', (event) => {
            setDownloaded(event.payload.downloaded ?? 0);
            setTotal(event.payload.total ?? 0);
        }).then((dispose) => {
            disposeProgress = dispose;
        });

        invoke('check_bl0ck_update').then(
            (info) => {
                setUpdateInfo(info);
                if (info.available) {
                    const notes = info.body?.trim() || 'A new Pot Bl0ck release is available.';
                    setBody(
                        `## ${info.releaseName}\n\n` +
                            `**${info.currentVersion} → ${info.latestVersion}**\n\n` +
                            notes
                    );
                } else {
                    setBody(`## ${t('updater.latest')}\n\n**${info.currentVersion}**`);
                }
                setChecking(false);
            },
            (error) => {
                const message = error.toString();
                setBody(message);
                setChecking(false);
                toast.error(message, { style: toastStyle });
            }
        );

        return () => {
            if (disposeProgress) {
                disposeProgress();
            }
        };
    }, []);

    const installUpdate = async () => {
        setInstalling(true);
        setDownloaded(0);
        setTotal(0);

        try {
            await invoke('install_bl0ck_update');
        } catch (error) {
            setInstalling(false);
            const message = error.toString();
            toast.error(message, { style: toastStyle });
        }
    };

    const updateButtonLabel = () => {
        if (installing) {
            if (total && downloaded >= total) {
                return t('updater.installing');
            }
            return t('updater.downloading');
        }
        if (!updateInfo?.available) {
            return t('updater.latest');
        }
        return t('updater.update');
    };

    return (
        <div
            className={`${transparent ? 'bg-background/90' : 'bg-background'} h-screen ${
                osType === 'Linux' && 'rounded-[10px] border-1 border-default-100'
            }`}
        >
            <Toaster />
            <div className='p-[5px] h-[35px] w-full select-none cursor-default'>
                <div
                    data-tauri-drag-region='true'
                    className={`h-full w-full flex ${osType === 'Darwin' ? 'justify-end' : 'justify-start'}`}
                >
                    <img
                        src='icon.png'
                        className='h-[25px] w-[25px] mr-[10px]'
                        draggable={false}
                    />
                    <h2>Pot Bl0ck Update</h2>
                </div>
            </div>

            <Card className='mx-[80px] mt-[10px] overscroll-auto h-[calc(100vh-150px)]'>
                <CardBody>
                    {checking || body === '' ? (
                        <div className='space-y-3'>
                            <Skeleton className='w-3/5 rounded-lg'>
                                <div className='h-3 w-3/5 rounded-lg bg-default-200' />
                            </Skeleton>
                            <Skeleton className='w-4/5 rounded-lg'>
                                <div className='h-3 w-4/5 rounded-lg bg-default-200' />
                            </Skeleton>
                            <Skeleton className='w-2/5 rounded-lg'>
                                <div className='h-3 w-2/5 rounded-lg bg-default-300' />
                            </Skeleton>
                        </div>
                    ) : (
                        <ReactMarkdown
                            className='markdown-body select-text'
                            components={{
                                code: ({ children }) => <Code size='sm'>{children}</Code>,
                                a: ({ href, children }) => (
                                    <a
                                        href='#'
                                        className='text-primary underline'
                                        onClick={(event) => {
                                            event.preventDefault();
                                            if (href) {
                                                open(href);
                                            }
                                        }}
                                    >
                                        {children}
                                    </a>
                                ),
                                h2: ({ node, ...props }) => (
                                    <b>
                                        <h2
                                            className='text-[24px]'
                                            {...props}
                                        />
                                        <hr />
                                        <br />
                                    </b>
                                ),
                                h3: ({ node, ...props }) => (
                                    <b>
                                        <br />
                                        <h3
                                            className='text-[18px]'
                                            {...props}
                                        />
                                        <br />
                                    </b>
                                ),
                                li: ({ children }) => <li className='list-disc list-inside'>{children}</li>,
                            }}
                        >
                            {body}
                        </ReactMarkdown>
                    )}
                </CardBody>
            </Card>

            {installing && (
                <Progress
                    aria-label='Downloading update'
                    label={
                        total && downloaded >= total ? t('updater.installing') : t('updater.progress')
                    }
                    value={progress}
                    classNames={{
                        base: 'w-full px-[80px]',
                        track: 'drop-shadow-md border border-default',
                        label: 'tracking-wider font-medium text-default-600',
                        value: 'text-foreground/60',
                    }}
                    showValueLabel={Boolean(total)}
                    size='sm'
                    isIndeterminate={!total}
                />
            )}

            <div className='grid gap-4 grid-cols-2 h-[50px] my-[10px] mx-[80px]'>
                {updateInfo?.available && !updateInfo.canInstall ? (
                    <Button
                        variant='flat'
                        color='primary'
                        onPress={() => open(updateInfo.releaseUrl)}
                    >
                        Open GitHub Release
                    </Button>
                ) : (
                    <Button
                        variant='flat'
                        color='primary'
                        isLoading={checking || installing}
                        isDisabled={checking || installing || !updateInfo?.available}
                        onPress={installUpdate}
                    >
                        {updateButtonLabel()}
                    </Button>
                )}

                <Button
                    variant='flat'
                    color='danger'
                    isDisabled={installing}
                    onPress={() => {
                        appWindow.close();
                    }}
                >
                    {t('updater.cancel')}
                </Button>
            </div>
        </div>
    );
}
