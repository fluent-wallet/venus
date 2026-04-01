import type React from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';
import type { InitialSendFlowState, TransferDraft } from './types';

type SendFlowContextValue = {
  draft: TransferDraft;
  assetSearchText?: string;
  setDraft: Dispatch<SetStateAction<TransferDraft>>;
  setAssetSearchText: Dispatch<SetStateAction<string | undefined>>;
};

const SendFlowContext = createContext<SendFlowContextValue | null>(null);

interface SendFlowProviderProps {
  initialState: InitialSendFlowState;
  children: ReactNode;
}

export const SendFlowProvider: React.FC<SendFlowProviderProps> = ({ initialState, children }) => {
  const [draft, setDraft] = useState(initialState.draft);
  const [assetSearchText, setAssetSearchText] = useState(initialState.assetSearchText);

  const value = useMemo(
    () => ({
      draft,
      assetSearchText,
      setDraft,
      setAssetSearchText,
    }),
    [assetSearchText, draft],
  );

  return <SendFlowContext.Provider value={value}>{children}</SendFlowContext.Provider>;
};

export function useSendFlow() {
  const context = useContext(SendFlowContext);
  if (!context) {
    throw new Error('useSendFlow must be used within SendFlowProvider');
  }

  return context;
}

export function useMaybeSendFlow() {
  return useContext(SendFlowContext);
}
