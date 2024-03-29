import React, { useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import { Tabs, TabsContent, type Tab } from './ContractTabs';

const Contract: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<Tab>('Recently');
  const pageViewRef = useRef<PagerView>(null);

  return (
    <View style={styles.container}>
      <Tabs currentTab={currentTab} pageViewRef={pageViewRef} />
      <TabsContent currentTab={currentTab} setCurrentTab={setCurrentTab} pageViewRef={pageViewRef} />
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
