import { SafeAreaView, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text, useTheme } from '@rneui/themed';
import { statusBarHeight } from '@utils/deviceInfo';
import { HomeStackName, RootStackList, WalletStackName } from '@router/configs';
import { useMemo, useState } from 'react';
import { Wallet, Mnemonic, randomBytes } from 'ethers';
import { chunk, shuffle } from 'lodash-es';
import { Button } from '@rneui/base';
import { BaseButton } from '@components/Button';
import { showMessage } from 'react-native-flash-message';
import { useVaultOfGroup } from '@core/WalletCore/Plugins/ReactInject';

const VerifySeedPhrase: React.FC<NativeStackScreenProps<RootStackList, 'BackUpVerify'>> = ({ navigation, route }) => {
  const { theme } = useTheme();
  const [userSelectSeedPhrase, setUserSelectSeedPhrase] = useState<Record<number, string | undefined>>({});
  const { seedPhrase, accountGroupId } = route.params;
  const vault = useVaultOfGroup(accountGroupId);
  const randomMenmonic = useMemo(() => Mnemonic.fromEntropy(randomBytes(32)), []);

  const randomSeedPhraseList = useMemo(() => {
    const randomList = randomMenmonic.phrase.split(' ').slice(0, 6);
    const chunkList = chunk(randomList, 2);

    return seedPhrase.map((item, index) => ({ ...item, word: shuffle([item.word, ...chunkList[index]]) }));
  }, [randomMenmonic.phrase, seedPhrase]);

  const handlePress = (index: number, word: string) => {
    if (!userSelectSeedPhrase[index]) {
      // add
      return setUserSelectSeedPhrase({ ...userSelectSeedPhrase, [index]: word });
    }

    if (userSelectSeedPhrase[index] && userSelectSeedPhrase[index] === word) {
      // delete
      return setUserSelectSeedPhrase({ ...userSelectSeedPhrase, [index]: undefined });
    } else {
      // modify
      return setUserSelectSeedPhrase({ ...userSelectSeedPhrase, [index]: word });
    }
  };

  const handleConfirm = async () => {
    console.log(seedPhrase, userSelectSeedPhrase);
    for (let i = 0; i < seedPhrase.length; i++) {
      const item = seedPhrase[i];

      if (item.word !== userSelectSeedPhrase[item.index]) {
        return showMessage({ type: 'warning', message: 'Wrong words, try again' });
      }
    }
    await vault.finishBackup();
    navigation.navigate(HomeStackName, { screen: WalletStackName });
    showMessage({ type: 'success', message: 'Backuped' });
  };

  return (
    <SafeAreaView
      className="flex-1 flex flex-col px-[24px] pb-[24px]"
      style={{ backgroundColor: theme.colors.surfacePrimaryWithOpacity7, paddingTop: statusBarHeight + 48 }}
    >
      <Text style={{ color: theme.colors.textBrand }} className="text-4xl font-bold leading-tight text-center mb-2">
        Verify your seed phrase
      </Text>

      {randomSeedPhraseList.map((item, index) => (
        <View key={index}>
          <Text>Word #{item.index + 1}</Text>

          <View className="flex flex-wrap flex-row justify-between">
            {item.word.map((word, i) => (
              <Button
                type="clear"
                key={i}
                onPress={() => handlePress(item.index, word)}
                containerStyle={{ backgroundColor: userSelectSeedPhrase[item.index] === word ? theme.colors.primary : undefined }}
              >
                <Text>{word}</Text>
              </Button>
            ))}
          </View>
        </View>
      ))}

      <BaseButton testID="confirm" onPress={handleConfirm} containerStyle={{ marginTop: 'auto' }}>
        Confirm
      </BaseButton>
    </SafeAreaView>
  );
};

export default VerifySeedPhrase;
