import { useTheme, Tab, TabView, Text, ListItem, Icon } from '@rneui/themed';
import { RootStackList, SendToStackName, StackNavigation } from '@router/configs';
import { statusBarHeight } from '@utils/deviceInfo';
import { useState } from 'react';
import { Pressable, SafeAreaView, View } from 'react-native';
import TokenIconUSDT from '@assets/icons/tokenUSDT.svg';
import { RouteProp } from '@react-navigation/native';
import TokenList from '@components/TokenList';

export const TokensStackName = 'Tokens';

const Tokens: React.FC<{ navigation: StackNavigation; route: RouteProp<RootStackList, typeof TokensStackName> }> = ({ navigation, route }) => {
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

      <TabView value={tabIndex} onChange={handleTabChange} animationType="spring">
        <TabView.Item className="w-full">
          <TokenList />
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
                  <TokenIconUSDT width={32} height={32} />
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
                      <Text style={{ color: theme.colors.textSecondary }} className="text-sm leading-6">
                        Nakamigos
                      </Text>
                      <Text style={{ color: theme.colors.contrastWhiteAndBlack }} className="text-sm leading-6">
                        Nakamigos #7733
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => navigation.navigate(SendToStackName)} style={{ width: '48%' }}>
                    <View style={{ backgroundColor: theme.colors.surfaceCard }} className="p-3 mb-3 rounded-md">
                      <View className="w-36 h-36">
                        <Text>Image</Text>
                      </View>
                      <Text style={{ color: theme.colors.textSecondary }} className="text-sm leading-6">
                        Nakamigos
                      </Text>
                      <Text style={{ color: theme.colors.contrastWhiteAndBlack }} className="text-sm leading-6">
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

export default Tokens;
