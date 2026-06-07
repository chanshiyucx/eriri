export const range = (start: number, end: number): number[] =>
  Array.from({ length: end - start }, (_, i) => start + i)
