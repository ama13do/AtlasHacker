// Texto de un campo aunque venga como número, null o undefined (borradores viejos o corruptos)
export const asText = (value: unknown): string => (value === null || value === undefined ? '' : String(value))
