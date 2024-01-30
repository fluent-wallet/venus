export const isWalletConnectUri = (uri: string) => {
  const wcUriPattern =
    /^wc:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})@[1-9]\d*?\?(bridge=[%\w.-]+&key=[0-9a-zA-Z]+)$/;
  return wcUriPattern.test(uri);
};
