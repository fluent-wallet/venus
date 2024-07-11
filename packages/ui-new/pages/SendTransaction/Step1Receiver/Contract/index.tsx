import type React from 'react';
import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import type PagerView from 'react-native-pager-view';
import { Tab, Tabs, TabsContent } from './ContractTabs';

const Contract: React.FC<{ setReceiver: (receiver: string) => void }> = ({ setReceiver }) => {
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
          if (Keyboard.isVisible()) {
            Keyboard.dismiss();
          }
          setReceiver(receiver);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 32,
    marginBottom: 16,
  },
});

export default Contract;
