import { useTheme } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';

type Primitive = null | undefined | string | number | boolean | symbol | bigint;

interface Props {
  data: Record<string, unknown> | Array<unknown> | Primitive | object;
}

export const PlaintextMessage = ({ data }: Props) => {
  const { colors } = useTheme();
  if (data === null || data === undefined) {
    return null;
  }

  if (Array.isArray(data)) {
    return (
      <View>
        {data.map((item) => {
          if (typeof item === 'object') return <PlaintextMessage data={item} />;
          return (
            <Text style={{ color: colors.textPrimary }} key={item}>
              {item}
            </Text>
          );
        })}
      </View>
    );
  }

  if (typeof data === 'object') {
    return Object.entries(data).map(([key, value]) => (
      <View key={key}>
        {typeof value === 'object' || Array.isArray(value) ? (
          <View>
            <Text style={{ color: colors.textPrimary }}>{key}: </Text>
            <PlaintextMessage data={value} />
          </View>
        ) : (
          <View style={styles.flex}>
            <Text style={{ color: colors.textPrimary }}>{key}: </Text>
            <Text style={{ color: colors.textPrimary, flex:1, flexWrap: 'wrap' }}>{value?.toString()}</Text>
          </View>
        )}
      </View>
    ));
  }

  return <Text style={{ color: colors.textPrimary }}>{data.toString()}</Text>;
};

const styles = StyleSheet.create({
  flex: {
    display: 'flex',
    flexDirection: 'row',
  },
});
