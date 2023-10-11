import type { PropsWithChildren } from 'react';
import { ScrollView, useColorScheme, View, Text } from 'react-native';
import { DebugInstructions, Header, LearnMoreLinks, ReloadInstructions } from 'react-native/Libraries/NewAppScreen';

type SectionProps = PropsWithChildren<{
  title: string;
}>;

function Section({ children, title }: SectionProps): JSX.Element {
  return (
    <View className="mt-8 px-2">
      <Text className="text-2xl text-black dark:text-white">{title}</Text>
      <Text className="mt-2 text-lg text-black dark:text-white">{children}</Text>
    </View>
  );
}

function Home() {
  const backgroundStyle = 'bg-neutral-300 dark:bg-slate-900';
  const isDarkMode = useColorScheme() === 'dark';
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" className={backgroundStyle}>
        <Header />
        <View className="bg-white dark:bg-black">
          <Section title="Step One">
            1 Edit <Text className="font-bold">App.tsx</Text> to change this screen and then come back to see your edits.
          </Section>
          <Section title="See Your Changes">
            <ReloadInstructions />
          </Section>
          <Section title="Debug">
            <DebugInstructions />
          </Section>
          <Section title="Learn More">Read the docs to discover what to do next:</Section>
          <LearnMoreLinks />
        </View>
      </ScrollView>
    </View>
  );
}

export default Home;
