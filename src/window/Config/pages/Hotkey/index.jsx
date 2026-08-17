import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { CardBody } from '@nextui-org/react';
import { Button } from '@nextui-org/react';
import { Input } from '@nextui-org/react';
import { Card } from '@nextui-org/react';
import React from 'react';

import { useConfig } from '../../../../hooks/useConfig';
import { useToastStyle } from '../../../../hooks';
import { osType } from '../../../../utils/env';
import { invoke } from '@tauri-apps/api';

const keyMap = {
    Backquote: '`',
    Backslash: '\\',
    BracketLeft: '[',
    BracketRight: ']',
    Comma: ',',
    Equal: '=',
    Minus: '-',
    Plus: 'PLUS',
    Period: '.',
    Quote: "'",
    Semicolon: ';',
    Slash: '/',
    Backspace: 'Backspace',
    CapsLock: 'Capslock',
    ContextMenu: 'Contextmenu',
    Space: 'Space',
    Tab: 'Tab',
    Convert: 'Convert',
    Delete: 'Delete',
    End: 'End',
    Help: 'Help',
    Home: 'Home',
    PageDown: 'Pagedown',
    PageUp: 'Pageup',
    Escape: 'Esc',
    PrintScreen: 'Printscreen',
    ScrollLock: 'Scrolllock',
    Pause: 'Pause',
    Insert: 'Insert',
    Suspend: 'Suspend',
};

function keyDown(e, setKey) {
    e.preventDefault();
    if (e.keyCode === 8) {
        setKey('');
    } else {
        let newValue = '';
        if (e.ctrlKey) {
            newValue = 'Ctrl';
        }
        if (e.shiftKey) {
            newValue = `${newValue}${newValue.length > 0 ? '+' : ''}Shift`;
        }
        if (e.metaKey) {
            newValue = `${newValue}${newValue.length > 0 ? '+' : ''}${osType === 'Darwin' ? 'Command' : 'Super'}`;
        }
        if (e.altKey) {
            newValue = `${newValue}${newValue.length > 0 ? '+' : ''}Alt`;
        }
        let code = e.code;
        if (code.startsWith('Key')) {
            code = code.substring(3);
        } else if (code.startsWith('Digit')) {
            code = code.substring(5);
        } else if (code.startsWith('Numpad')) {
            code = 'Num' + code.substring(6);
        } else if (code.startsWith('Arrow')) {
            code = code.substring(5);
        } else if (code.startsWith('Intl')) {
            code = code.substring(4);
        } else if (/F\d+/.test(code)) {
        } else if (keyMap[code] !== undefined) {
            code = keyMap[code];
        } else {
            code = '';
        }
        setKey(`${newValue}${newValue.length > 0 && code.length > 0 ? '+' : ''}${code}`);
    }
}

function HotkeyInput({ name, value, setValue, label, t, toastStyle }) {
    const currentValue = value ?? '';
    const [draft, setDraft] = React.useState(currentValue);
    const [editing, setEditing] = React.useState(false);

    React.useEffect(() => {
        if (!editing) {
            setDraft(currentValue);
        }
    }, [currentValue, editing]);

    async function saveHotkey() {
        try {
            await invoke('replace_shortcut_by_frontend', {
                name,
                oldShortcut: currentValue,
                newShortcut: draft,
            });
            setValue(draft);
            setEditing(false);
            toast.success(t('config.hotkey.success'), { style: toastStyle });
        } catch (e) {
            setDraft(currentValue);
            setEditing(false);
            toast.error(e?.toString?.() ?? String(e), { style: toastStyle });
        }
    }

    return (
        <Input
            type='hotkey'
            variant='bordered'
            value={editing ? draft : currentValue}
            label={label}
            className='max-w-[50%]'
            onKeyDown={(e) => {
                keyDown(e, setDraft);
            }}
            onFocus={() => {
                if (!editing) {
                    setDraft(currentValue);
                    setEditing(true);
                }
            }}
            endContent={
                <Button
                    size='sm'
                    variant='flat'
                    className={`${!editing && 'hidden'}`}
                    onPress={saveHotkey}
                >
                    {t('common.ok')}
                </Button>
            }
        />
    );
}

export default function Hotkey() {
    // Keep edits local until the backend has successfully registered the new
    // shortcut. The backend persists config only after a successful swap.
    const [selectionTranslate, setSelectionTranslate] = useConfig('hotkey_selection_translate', '', { sync: false });
    const [inputTranslate, setInputTranslate] = useConfig('hotkey_input_translate', '', { sync: false });
    const [ocrRecognize, setOcrRecognize] = useConfig('hotkey_ocr_recognize', '', { sync: false });
    const [ocrTranslate, setOcrTranslate] = useConfig('hotkey_ocr_translate', '', { sync: false });

    const { t } = useTranslation();
    const toastStyle = useToastStyle();

    return (
        <Card>
            <Toaster />
            <CardBody>
                <div className='config-item'>
                    <h3 className='my-auto'>{t('config.hotkey.selection_translate')}</h3>
                    {selectionTranslate !== null && (
                        <HotkeyInput
                            name='hotkey_selection_translate'
                            value={selectionTranslate}
                            setValue={setSelectionTranslate}
                            label={t('config.hotkey.set_hotkey')}
                            t={t}
                            toastStyle={toastStyle}
                        />
                    )}
                </div>
                <div className='config-item'>
                    <h3 className='my-auto'>{t('config.hotkey.input_translate')}</h3>
                    {inputTranslate !== null && (
                        <HotkeyInput
                            name='hotkey_input_translate'
                            value={inputTranslate}
                            setValue={setInputTranslate}
                            label={t('config.hotkey.set_hotkey')}
                            t={t}
                            toastStyle={toastStyle}
                        />
                    )}
                </div>
                <div className='config-item'>
                    <h3 className='my-auto'>{t('config.hotkey.ocr_recognize')}</h3>
                    {ocrRecognize !== null && (
                        <HotkeyInput
                            name='hotkey_ocr_recognize'
                            value={ocrRecognize}
                            setValue={setOcrRecognize}
                            label={t('config.hotkey.set_hotkey')}
                            t={t}
                            toastStyle={toastStyle}
                        />
                    )}
                </div>
                <div className='config-item'>
                    <h3 className='my-auto'>{t('config.hotkey.ocr_translate')}</h3>
                    {ocrTranslate !== null && (
                        <HotkeyInput
                            name='hotkey_ocr_translate'
                            value={ocrTranslate}
                            setValue={setOcrTranslate}
                            label={t('config.hotkey.set_hotkey')}
                            t={t}
                            toastStyle={toastStyle}
                        />
                    )}
                </div>
            </CardBody>
        </Card>
    );
}
