import Button from '@components/Button';
import Text from '@components/Text';
import { BottomSheetScrollContent, BottomSheetFooter } from '@components/BottomSheet';
import { useVaultFromId } from '@core/WalletCore/Plugins/ReactInject';
import { useTheme } from '@react-navigation/native';
import { type BackupScreenProps, type BackupStep3StackName, BackupSuccessStackName } from '@router/configs';
import { wordlists } from 'bip39';
import { sampleSize, shuffle } from 'lodash-es';
import type React from 'react';
import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import BackupBottomSheet from './BackupBottomSheet';

type Ele = string | null;
const BackupStep3RandomCheck: React.FC<BackupScreenProps<typeof BackupStep3StackName>> = ({ route, navigation }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { phrases, vaultId } = route.params;
  const vault = useVaultFromId(vaultId);

  const [selectedWords, setSelectedWords] = useState<[Ele, Ele, Ele]>([null, null, null]);

  const mixers = useMemo(() => {
    const words = wordlists.english;
    const phrasesWithIndex = phrases.map((phrase, originIndex) => ({ phrase, originIndex }));
    const randomWithIndex = sampleSize(phrasesWithIndex, 3).sort((a, b) => a.originIndex - b.originIndex);
    return randomWithIndex.map(({ phrase, originIndex }) => {
      const mixer: Array<string> = [phrase];
      while (mixer.length < 3) {
        const word = sampleSize(words, 1)[0];
        if (mixer.includes(word)) continue;
        mixer.push(word);
      }
      return { phrase, originIndex, mixer: shuffle(mixer) };
    });
  }, [phrases]);

  const isAllSelected = useMemo(() => selectedWords?.every((word) => !!word), [selectedWords]);
  const isAllCorrect = useMemo(() => selectedWords?.every((word, index) => word === mixers[index].phrase), [selectedWords, mixers]);

  return (
    <BackupBottomSheet>
      <BottomSheetScrollContent>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('backup.verify.title')}</Text>
        {mixers.map(({ originIndex, mixer }, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
          <Fragment key={index}>
            <Text style={[styles.text, { color: colors.textPrimary }]}>
              {t('backup.verify.word')} #{originIndex + 1}
            </Text>
            <View style={styles.wordsWrapper}>
              {mixer.map((word) => (
                <Pressable
                  key={word}
                  onPress={() =>
                    setSelectedWords((pre) => {
                      pre[index] = pre[index] === word ? null : word;
                      return [pre[0], pre[1], pre[2]];
                    })
                  }
                  style={({ pressed }) => [
                    styles.word,
                    {
                      backgroundColor: selectedWords[index] === word ? colors.bgSelect : pressed ? colors.bgSelect : 'transparent',
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                  testID="word"
                >
                  <Text style={[styles.text, { color: colors.textPrimary }]}>{word}</Text>
                </Pressable>
              ))}
            </View>
          </Fragment>
        ))}
      </BottomSheetScrollContent>
      <BottomSheetFooter>
        <Button
          testID="confirm"
          disabled={!isAllSelected}
          onPress={() => {
            if (isAllCorrect) {
              vault?.finishBackup?.();
              navigation.navigate(BackupSuccessStackName);
            } else {
              showMessage({
                message: '🤔 Wrong word, please check again.',
                type: 'warning',
              });
            }
          }}
          size="small"
        >
          {t('common.confirm')}
        </Button>
      </BottomSheetFooter>
    </BackupBottomSheet>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    marginTop: 20,
    marginBottom: 32,
  },
  wordsWrapper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  word: {
    flexShrink: 1,
    flexGrow: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '33.3%',
    height: 40,
    borderRadius: 6,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
});

export default BackupStep3RandomCheck;
