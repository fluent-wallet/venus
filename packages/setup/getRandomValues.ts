import RNQC from 'react-native-quick-crypto';
global.getRandomValues = RNQC.getRandomValues;
export * from '@ethersproject/shims';
