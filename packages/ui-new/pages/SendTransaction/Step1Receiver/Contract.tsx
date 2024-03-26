import React from 'react';
import { useRecentlyAddress } from '@core/WalletCore/Plugins/ReactInject';

const Contract: React.FC = () => {
  const recentlyAddress = useRecentlyAddress();
  return null;
};

export default Contract;
