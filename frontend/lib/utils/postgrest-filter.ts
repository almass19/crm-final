/**
 * Escapes a value for safe interpolation into a PostgREST `.or()`/`.and()`
 * filter string. Without quoting, commas, dots, and parentheses in the value
 * are parsed as filter syntax (e.g. extra OR conditions), letting user input
 * change which rows the query matches. Wrapping in double quotes and
 * escaping backslashes/quotes neutralizes that per PostgREST's filter grammar.
 */
export function escapePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
