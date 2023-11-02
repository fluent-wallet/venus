import { Text, useTheme } from '@rneui/themed';
import { View } from 'react-native';
import CheckIcon from '@assets/icons/check.svg';

const hierarchicalDeterministicGuidelines = ['Do NOT take a screenshot of this page', 'Writing down on paper is recommended'];
const privateKeyGuidelines = [
  'Do NOT take a screenshot of this page',
  'Writing down on paper is recommended',
  'Or scan the QR code directly from the trusted app you wish to import to',
];

const SafetyGuidelines = ({ backupType }: { backupType: 'Seed Phrase' | 'Private Key' }) => {
  const { theme } = useTheme();
  const guidelines = backupType === 'Seed Phrase' ? hierarchicalDeterministicGuidelines : privateKeyGuidelines;

  return (
    <View>
      {guidelines.map((value) => (
        <View key={value} className="flex flex-row items-start mb-2">
          <CheckIcon color={theme.colors.surfaceBrand} width={26} height={24} />
          <Text className="leading-6 ml-2">{value}</Text>
        </View>
      ))}
    </View>
  );
};

export default SafetyGuidelines;
