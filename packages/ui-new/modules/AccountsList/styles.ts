import { StyleSheet } from 'react-native';

export const accountListSizes = { account: 64, groupHeader: 48, sectionSpacing: 8 } as const;

export const styles = StyleSheet.create({
  row: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    height: accountListSizes.account,
    paddingHorizontal: 16,
  },
  placeholder: {
    height: accountListSizes.sectionSpacing,
  },
  group: {
    height: accountListSizes.groupHeader,
  },
  groupTypeImage: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  groupName: {
    marginRight: 8,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '300',
  },
  groupSettings: {
    marginLeft: 'auto',
  },
  accountImage: {
    width: 32,
    height: 32,
    borderRadius: 32,
    marginRight: 6,
  },
  accountName: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  accountAddressWrapper: {
    marginTop: 4,
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountAddress: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '300',
    borderStyle: 'dashed',
  },
  accountAddressCopy: {
    marginHorizontal: 12,
  },
  accountRight: {
    marginLeft: 'auto',
    marginRight: 16,
  },
  manageText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  addAccountLoading: {
    marginLeft: 'auto',
    width: 20,
    height: 20,
  },
  divider: {
    marginVertical: 12,
    height: 1,
  },
});
