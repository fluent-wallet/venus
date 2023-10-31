import { useTheme, Tab, TabView, Text, ListItem, Icon } from '@rneui/themed';
import { SendToStackName, StackNavigation } from '@router/configs';
import { statusBarHeight } from '@utils/deviceInfo';
import { useState } from 'react';
import { FlatList, Pressable, SafeAreaView, View } from 'react-native';
import TokenIconBTC from '@assets/icons/tokenBTC.svg';

export const TokenListStackName = 'TokenList';

const TokenList: React.FC<{ navigation: StackNavigation }> = ({ navigation }) => {
  const { theme } = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const handleTabChange = (index: number) => {
    navigation.setOptions({ headerTitle: index === 0 ? 'Tokens' : 'NFTs' });
    setTabIndex(index);
  };
  return (
    <SafeAreaView
      className="flex flex-1 flex-col justify-start pb-7"
      style={{ backgroundColor: theme.colors.normalBackground, paddingTop: statusBarHeight + 48 }}
    >
      <View className="px-6">
        <Tab value={tabIndex} onChange={handleTabChange} indicatorStyle={{ backgroundColor: theme.colors.surfaceBrand }}>
          <Tab.Item title="Tokens" titleStyle={(active) => ({ color: active ? theme.colors.textBrand : theme.colors.textSecondary })} />
          <Tab.Item title="NFTs" titleStyle={(active) => ({ color: active ? theme.colors.textBrand : theme.colors.textSecondary })} />
        </Tab>
      </View>

      <TabView value={tabIndex} onChange={handleTabChange} animationType="spring" tabItemContainerStyle={{ paddingHorizontal: 25, paddingVertical: 15 }}>
        <TabView.Item className="w-full">
          <FlatList
            data={[
              {
                tokenName: 'Bitcoin',
                tokenSymbol: 'BTC',
                tokenIcon: TokenIconBTC,
                tokenValue: '1900',
                tokenBalance: '2000.00',
              },
            ]}
            renderItem={({ item: { tokenIcon: TokenIcon, tokenName, tokenBalance, tokenValue, tokenSymbol } }) => (
              <Pressable onPress={() => navigation.navigate(SendToStackName)}>
                <View className="flex flex-row w-full justify-between p-4 mb-4">
                  <View className="flex flex-row items-center">
                    <TokenIcon width={48} height={48} />
                    <Text className="ml-4 text-base font-normal leading-6">{tokenName}</Text>
                  </View>
                  <View className="flex items-end">
                    <Text className="text-base font-normal leading-6">
                      {tokenBalance}
                      {tokenSymbol}
                    </Text>
                    <Text style={{ color: theme.colors.textSecondary }} className="text-base font-normal leading-6">
                      ${tokenValue}
                    </Text>
                  </View>
                </View>
              </Pressable>
            )}
          />
        </TabView.Item>
        <TabView.Item className="w-full">
          <View className="flex flex-1 w-full">
            <ListItem.Accordion
              isExpanded={isExpanded}
              onPress={() => setIsExpanded(!isExpanded)}
              containerStyle={{
                backgroundColor: theme.colors.normalBackground,
                display: 'flex',
                justifyContent: 'space-between',
              }}
              icon={<Icon name="keyboard-arrow-right" color={theme.colors.contrastWhiteAndBlack} />}
              expandIcon={<Icon name="keyboard-arrow-up" color={theme.colors.contrastWhiteAndBlack} />}
              content={
                <View className="flex flex-row items-center">
                  <TokenIconBTC width={32} height={32} />
                  <Text style={{ color: theme.colors.contrastWhiteAndBlack }} className="text-base font-medium leading-6 ml-2">
                    Test NFTs
                  </Text>
                </View>
              }
            >
              <ListItem containerStyle={{ backgroundColor: 'transparent' }}>
                <View className="flex flex-row flex-wrap justify-between">
                  <Pressable onPress={() => navigation.navigate(SendToStackName)} style={{ width: '48%' }}>
                    <View style={{ backgroundColor: theme.colors.surfaceCard }} className="p-3 mb-3 rounded-md">
                      <View className="w-36 h-36">
                        <Text>Image</Text>
                      </View>
                      <Text style={{ color: theme.colors.textSecondary }} className="text-sm font-normal leading-6">
                        Nakamigos
                      </Text>
                      <Text style={{ color: theme.colors.contrastWhiteAndBlack }} className="text-sm font-normal leading-6">
                        Nakamigos #7733
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => navigation.navigate(SendToStackName)} style={{ width: '48%' }}>
                    <View style={{ backgroundColor: theme.colors.surfaceCard }} className="p-3 mb-3 rounded-md">
                      <View className="w-36 h-36">
                        <Text>Image</Text>
                      </View>
                      <Text style={{ color: theme.colors.textSecondary }} className="text-sm font-normal leading-6">
                        Nakamigos
                      </Text>
                      <Text style={{ color: theme.colors.contrastWhiteAndBlack }} className="text-sm font-normal leading-6">
                        Nakamigos #7733
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </ListItem>
            </ListItem.Accordion>
          </View>
        </TabView.Item>
      </TabView>
    </SafeAreaView>
  );
};

export default TokenList;
