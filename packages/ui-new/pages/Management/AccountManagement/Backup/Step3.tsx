import React, { useState, useMemo, useRef, Fragment } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { wordlists } from 'bip39';
import { sampleSize, shuffle } from 'lodash-es';
import { type Vault } from '@core/database/models/Vault';
import Text from '@components/Text';
import Button from '@components/Button';
import { BottomSheetMethods } from '@components/BottomSheet';
import BackupResult from './BackupResult';

type Ele = string | null;
const BackupStep3: React.FC<{ phrases: Array<string>; vault: Vault }> = ({ phrases, vault }) => {
  const { colors } = useTheme();
  const bottomSheetRef = useRef<BottomSheetMethods>(null!);

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
  console.log(isAllCorrect)
  return (
    <>
      <Text style={[styles.title, { color: colors.textPrimary }]}>🔍 Verify your seed phrase</Text>
      {mixers.map(({ originIndex, mixer }, index) => (
        <Fragment key={index}>
          <Text style={[styles.text, { marginHorizontal: 16, color: colors.textPrimary }]}>Word #{originIndex + 1}</Text>
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
                  { backgroundColor: selectedWords[index] === word ? colors.bgSelect : pressed ? colors.bgSelect : 'transparent', opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Text style={[styles.text, { color: colors.textPrimary }]}>{word}</Text>
              </Pressable>
            ))}
          </View>
        </Fragment>
      ))}
      <Button style={styles.btn} mode="auto" disabled={!isAllSelected} onPress={() => {
        bottomSheetRef.current?.expand();
        if (isAllCorrect) {
          vault?.finishBackup?.();
        }
      }}>
        Confirm
      </Button>
      <BackupResult bottomSheetRef={bottomSheetRef} type={isAllCorrect ? 'success' : 'failed'} />
    </>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    marginTop: 20,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  wordsWrapper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 24,
    marginHorizontal: 16,
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
  btn: {
    marginTop: 'auto',
    marginBottom: 32,
    marginHorizontal: 16,
  },
});

export default BackupStep3;
