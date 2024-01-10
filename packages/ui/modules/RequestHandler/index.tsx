import { useCallback, useEffect, useState, type PropsWithChildren } from 'react';
import { View } from 'react-native';
import { BottomSheet, useTheme } from '@rneui/themed';
import events from '@core/WalletCore/Events';
import { type RequestSubject } from '@core/WalletCore/Events/requestSubject';
import { RequestType } from '@core/database/models/Request/RequestType';
import WalletConnectHandler from './WalletConnect';

const RequestHandler = ({ children }: PropsWithChildren) => {
  const { theme } = useTheme();

  const [visible, setVisible] = useState(false);
  const [currentRequestSubject, setCurrentRequestSubject] = useState<RequestSubject | null>(null);

  useEffect(() => {
    const subscription = events.newestRequestSubject.subscribe({
      next: (request) => {
        setVisible(true);
        setCurrentRequestSubject(request);
      },
    });

    return () => {
      setVisible(false);
      subscription.unsubscribe();
    };
  }, []);

  const handleResolve = useCallback(() => {
    currentRequestSubject?.resolve?.(true);
    setVisible(false);
    setCurrentRequestSubject(null);
  }, [currentRequestSubject]);

  const handleReject = useCallback(() => {
    currentRequestSubject?.reject?.('User reject request.');
    setVisible(false);
    setCurrentRequestSubject(null);
  }, [currentRequestSubject]);

  return (
    <BottomSheet isVisible={visible} onBackdropPress={handleReject}>
      <View className="h-[240px] rounded-t-[16px] px-[24px] pt-[12px]" style={{ backgroundColor: theme.colors.surfaceCard }}>
        {currentRequestSubject && (
          <>
            {currentRequestSubject.request.type === RequestType.WalletConnectProposal && (
              <WalletConnectHandler requestSubject={currentRequestSubject} handleReject={handleReject} handleResolve={handleResolve} />
            )}
          </>
        )}
      </View>
    </BottomSheet>
  );
};

export default RequestHandler;
