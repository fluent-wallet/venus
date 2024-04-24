import React, { useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import PagerView from 'react-native-pager-view';
import { SendTransactionStep2StackName, SendTransactionStep1StackName, type SendTransactionScreenProps } from '@router/configs';
import { Tabs, TabsContent, Tab } from './ContractTabs';

const Contract: React.FC<{ setReceiver: (receiver: string) => void }> = ({ setReceiver }) => {
  const navigation = useNavigation<SendTransactionScreenProps<typeof SendTransactionStep1StackName>['navigation']>();
  const [currentTab, setCurrentTab] = useState<Tab>(Tab.Recently);
  const pageViewRef = useRef<PagerView>(null);

  return (
    <View style={styles.container}>
      <Tabs currentTab={currentTab} pageViewRef={pageViewRef} />
      <TabsContent
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        pageViewRef={pageViewRef}
        onPressReceiver={(receiver) => {
          setReceiver(receiver);
          navigation.navigate(SendTransactionStep2StackName, { targetAddress: receiver });
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginVertical: 16,
  },
});

export default Contract;
