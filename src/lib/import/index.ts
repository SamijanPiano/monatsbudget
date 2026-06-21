// Öffentliche API der Import-Bibliothek (Bank-Auszüge → ParsedTransaction).

export type { ParsedTransaction } from './types'
export { transactionHash, mergeNew } from './dedup'
export { parseCamt053 } from './camt053'
export {
  parseCsv,
  detectPreset,
  DE_BANK_PRESETS,
} from './csv'
export type { CsvMapping, CsvColumns, CsvDateFormat } from './csv'
