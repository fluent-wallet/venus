export const getAccountGroupRootKey = () => ['accountGroup'] as const;
export const getAccountGroupListKey = (includeHidden = false) => ['accountGroup', 'list', includeHidden] as const;
export const getAccountGroupKey = (groupId: string, includeHidden = false) => ['accountGroup', 'byId', groupId, includeHidden] as const;
