export const camelCase = str => {
  return str.replace(/_([a-z])/g, function (match, group1) {
    return group1.toUpperCase();
  });
};
