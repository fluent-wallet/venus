import React, { type ComponentProps } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';
import Button from '@components/Button';
import Text from '@components/Text';
import { HomeStackName, SendTransactionStackName, SendTransactionStep1StackName, ReceiveStackName, type StackScreenProps } from '@router/configs';
import ArrowUpward from '@assets/icons/arrow-upward.svg';
import ArrowDownward from '@assets/icons/arrow-downward.svg';
import Buy from '@assets/icons/buy.svg';
import More from '@assets/icons/more.svg';
import MoreOption from './MoreOption';

export const Navigation: React.FC<{ title: string; Icon: ComponentProps<typeof Button>['Icon']; onPress?: VoidFunction; disabled?: boolean }> = ({
  title,
  Icon,
  onPress,
  disabled,
}) => {
  const { colors } = useTheme();

  return (
    <Pressable style={styles.navigation} onPress={onPress} disabled={disabled}>
      <Button testID={title} square size="small" Icon={Icon} onPress={onPress} disabled={disabled} />
      <Text style={[styles.navigationText, { color: disabled ? colors.iconThird : colors.textPrimary }]}>{title}</Text>
    </Pressable>
  );
};

const Navigations: React.FC<{ navigation: StackScreenProps<typeof HomeStackName>['navigation'] }> = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Navigation title="Send" Icon={ArrowUpward} onPress={() => navigation.navigate(SendTransactionStackName, { screen: SendTransactionStep1StackName })} />
      <Navigation title="Receive" Icon={ArrowDownward} onPress={() => navigation.navigate(ReceiveStackName)} />
      <Navigation title="Buy" Icon={Buy} disabled />
      <MoreOption>
        <Navigation title="More" Icon={More} />
      </MoreOption>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
    marginBottom: 24,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  navigation: {
    flex: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  navigationText: {
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 20,
  },
});

export default Navigations;
