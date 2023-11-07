import { compose, withDatabase, withObservables, type Database } from '@DB/react';
import { Network } from '@core/DB/models/Network';
import { querySelectedNetwork } from '@core/DB/models/Network/service';
import { Button } from '@rneui/base';
import { Text, useTheme } from '@rneui/themed';
import { map } from 'rxjs';

const SwitchCurrentNetwork = compose(
  withDatabase,
  withObservables([], ({ database }: { database: Database }) => ({
    currentNetwork: querySelectedNetwork(database)
      .observe()
      .pipe(map((network) => network?.[0])),
  }))
)(({ currentNetwork }: { currentNetwork: Network }) => {
  const { theme } = useTheme();
  return (
    <Button
      type="outline"
      titleStyle={{ color: theme.colors.contrastWhiteAndBlack, fontSize: 10, fontFamily: 'SF Pro Display' }}
      buttonStyle={{ borderRadius: 40, borderColor: theme.colors.surfaceSecondary }}
      onPress={currentNetwork.switchESpaceNetwork.bind(currentNetwork)}
    >
      <Text>{currentNetwork.name}</Text>
    </Button>
  );
});
export default SwitchCurrentNetwork;
