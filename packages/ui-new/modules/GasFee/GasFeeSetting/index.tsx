/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Pressable, Keyboard } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { isEqual } from 'lodash-es';
import BottomSheet, { snapPoints, type BottomSheetMethods } from '@components/BottomSheet';
import Text from '@components/Text';
import useGasEstimate, { Level } from '@core/WalletCore/Plugins/Transaction/useGasEstimate';

interface SelectedGasEstimate {
  gasLimit: string;
  storageLimit?: string;
  gasPrice: string;
  suggestedGasPrice?: string;
  suggeestedMaxFeePerGas?: string;
  suggestedMaxPriorityFeePerGas?: string;
  gasCost: string;
  type: 'customize' | Level;
}

interface Props {
  show: boolean;
  onClose: () => void;
  tx: Parameters<typeof useGasEstimate>[0];
  onChange?: (gasEstimate: SelectedGasEstimate | null) => void;
}

const GasFeeSetting: React.FC<Props> = ({ show, onClose, tx, onChange }) => {
  const { colors } = useTheme();
  const gasEstimate = useGasEstimate(tx);
  const estimate = gasEstimate ? gasEstimate.estimateOf1559 ?? gasEstimate.estimate : null;

  const [selectedGasEstimate, setSelectedGasEstimate] = useState<SelectedGasEstimate | null>(null);
  useEffect(() => onChange?.(selectedGasEstimate), [selectedGasEstimate, onChange]);
  
  useEffect(() => {
    if (selectedGasEstimate === null) {
      if (gasEstimate && estimate) {
        setSelectedGasEstimate({
          gasLimit: gasEstimate.gasLimit,
          gasPrice: gasEstimate.gasPrice,
          storageLimit: gasEstimate.storageLimit,
          ...estimate.medium,
          type: 'medium',
        });
      }
    } else if (selectedGasEstimate.type !== 'customize') {
      if (gasEstimate && estimate) {
        const newGasEstimate = {
          gasLimit: gasEstimate.gasLimit,
          gasPrice: gasEstimate.gasPrice,
          storageLimit: gasEstimate.storageLimit,
          ...estimate[selectedGasEstimate.type],
          type: selectedGasEstimate.type,
        };
        if (!isEqual(selectedGasEstimate, newGasEstimate)) {
          setSelectedGasEstimate(newGasEstimate);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gasEstimate, selectedGasEstimate]);

  if (!show) return;
  return (
    <>
      <BottomSheet snapPoints={snapPoints.large} style={styles.container} onClose={onClose}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Network Fee</Text>
      </BottomSheet>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },

  btn: {
    marginTop: 'auto',
    marginBottom: 32,
    marginHorizontal: 16,
  },
});

export default GasFeeSetting;
