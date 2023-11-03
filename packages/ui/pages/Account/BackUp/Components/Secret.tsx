import { BaseButton } from '@components/Button';
import { Icon, Text, useTheme, Tooltip } from '@rneui/themed';
import clsx from 'clsx';
import { useState } from 'react';
import { View, useColorScheme } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Clipboard from '@react-native-clipboard/clipboard';

const emptyString = '           ';

const Secret = ({ backupType, getSecretData }: { backupType: 'Seed Phrase' | 'Private Key'; getSecretData: () => Promise<string> }) => {
  const { theme } = useTheme();
  const colorScheme = useColorScheme();
  const [secret, setSecret] = useState(emptyString);
  const [isShow, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tooltipShow, setTooltipShow] = useState(false);

  const handleGetSecretData = async () => {
    try {
      setLoading(true);
      const data = await getSecretData();
      setShow(true);
      setSecret(data);
    } catch (error) {
      // do nothing
      console.log('get vault is error', error);
      setSecret(emptyString);
      setShow(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = () => {
    Clipboard.setString(secret);
    setTooltipShow(true);
  };

  return (
    <View>
      <View className="flex flex-wrap content-between px-4 py-4 rounded-lg h-[314px] relative last:mb-0" style={{ backgroundColor: theme.colors.surfaceCard }}>
        {backupType === 'Seed Phrase' ? (
          secret.split(' ').map((value, index) => (
            <View
              key={index}
              style={{ backgroundColor: theme.colors.surfaceThird, width: '48%' }}
              className={clsx('px-4 py-2 rounded-full', { 'mb-2': (index + 1) % 6 !== 0 })}
            >
              <Text className="text-center leading-6">
                {index + 1}. {value}
              </Text>
            </View>
          ))
        ) : (
          <View className="flex flex-1 w-full justify-center items-center">
            <QRCode value={secret} size={280} />
          </View>
        )}

        {!isShow && (
          <View
            className="absolute top-0 right-0 bottom-0 left-0 flex justify-center items-center"
            style={{ backgroundColor: colorScheme === 'dark' ? 'rgba(23, 23, 23, 1)' : 'rgba(255, 255, 255,1)' }}
          >
            <Text className="text-xl font-bold leading-tight">Tap to view the {backupType === 'Seed Phrase' ? 'seed phrase' : 'private key'}</Text>
            <Text className="text-base font-normal leading-6">Make sure your environment is safe</Text>
            <View className="mt-4">
              <BaseButton loading={loading} buttonStyle={{ paddingHorizontal: 20, paddingVertical: 10 }} onPress={handleGetSecretData}>
                <Icon name="remove-red-eye" className="pr-1" color={theme.colors.textInvert} />
                <Text className="text-sm leading-6" style={{ color: theme.colors.textInvert }}>
                  View
                </Text>
              </BaseButton>
            </View>
          </View>
        )}
      </View>
      {backupType === 'Private Key' && isShow && (
        <View className="flex flex-row items-center my-4 p-2" style={{ backgroundColor: theme.colors.surfaceCard }}>
          <Text className="shrink text-sm leading-5" style={{ color: theme.colors.textSecondary }}>
            {secret}
          </Text>
          <Tooltip
            backgroundColor={theme.colors.surfaceCard}
            visible={tooltipShow}
            popover={
              <Text className="text-xs" style={{ color: theme.colors.textSecondary }}>
                Successfully Copied！
              </Text>
            }
            onOpen={handleCopyToClipboard}
            onClose={() => setTooltipShow(false)}
          >
            <Icon name="copy-all" className="mx-4" color={'#537FF6'} />
          </Tooltip>
        </View>
      )}
    </View>
  );
};

export default Secret;
