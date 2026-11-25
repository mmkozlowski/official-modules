/** `ZP/2026/7` → 7; anything else → 0. Pure — shared by the API and the demo reset script. */
export function sequenceOf(number: string, year: string): number {
  const match = new RegExp(`^ZP/${year}/(\\d+)$`).exec(number)
  return match ? Number(match[1]) : 0
}

export function formatOrderNumber(year: string, sequence: number): string {
  return `ZP/${year}/${String(sequence).padStart(3, '0')}`
}
