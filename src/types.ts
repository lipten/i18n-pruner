export interface ScanResult {
  usedKeys: Set<string>
  dynamicKeys: Array<{
    file: string
    line: number
    code: string
  }>
}
