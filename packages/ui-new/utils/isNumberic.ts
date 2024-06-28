export function isNumeric(str: string) {
  if (typeof str != 'string') return false; // we only process strings!
  return (
    !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    !isNaN(Number.parseFloat(str))
  ); // ...and ensure strings of whitespace fail
}
