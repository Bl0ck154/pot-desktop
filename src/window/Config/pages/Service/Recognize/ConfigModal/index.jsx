import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Spacer } from '@nextui-org/react';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { ServiceSourceType, getServiceName, getServiceSouceType, whetherPluginService } from '../../../../../../utils/service_instance';
import * as builtinServices from '../../../../../../services/recognize';
import { osType } from '../../../../../../utils/env';
import { PluginConfig } from '../../PluginConfig';

export default function ConfigModal(props) {
    const { serviceInstanceKey, pluginList, isOpen, onOpenChange, updateServiceInstanceList } = props;
    const serviceSourceType = getServiceSouceType(serviceInstanceKey);
    const pluginServiceFlag = whetherPluginService(serviceInstanceKey);
    const serviceName = getServiceName(serviceInstanceKey);
    const { t } = useTranslation();
    const ConfigComponent = pluginServiceFlag ? PluginConfig : builtinServices[serviceName].Config;
    const builtinTitle = pluginServiceFlag ? '' : t(`services.recognize.${serviceName}.title`, {
        defaultValue: builtinServices[serviceName].info.displayName ?? builtinServices[serviceName].info.name,
    });
    const pluginFormId = pluginServiceFlag
        ? `plugin-config-${serviceInstanceKey.replace(/[^a-zA-Z0-9_-]/g, '-')}`
        : undefined;

    return pluginServiceFlag && !(serviceName in pluginList) ? <></> : (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} scrollBehavior='inside'>
            <ModalContent className='max-h-[75vh]'>
                {(onClose) => (
                    <>
                        <ModalHeader>
                            {serviceSourceType === ServiceSourceType.BUILDIN && <><img src={serviceName === 'system' ? `logo/${osType}.svg` : builtinServices[serviceName].info.icon} className='h-[24px] w-[24px] my-auto' draggable={false} /><Spacer x={2} />{builtinTitle}</>}
                            {pluginServiceFlag && <><img src={pluginList[serviceName].icon} className='h-[24px] w-[24px] my-auto' draggable={false} /><Spacer x={2} />{`${pluginList[serviceName].display} [${t('common.plugin')}]`}</>}
                        </ModalHeader>
                        <ModalBody>
                            <ConfigComponent
                                name={serviceName}
                                instanceKey={serviceInstanceKey}
                                pluginType='recognize'
                                pluginList={pluginList}
                                updateServiceList={updateServiceInstanceList}
                                onClose={onClose}
                                formId={pluginFormId}
                            />
                        </ModalBody>
                        <ModalFooter>
                            <Button color='danger' variant='light' onPress={onClose}>{t('common.cancel')}</Button>
                            {pluginServiceFlag && (
                                <Button color='primary' type='submit' form={pluginFormId}>
                                    {t('common.save')}
                                </Button>
                            )}
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
