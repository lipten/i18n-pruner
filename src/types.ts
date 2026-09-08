export type DynamicKeyPolicy = 'warn' | 'ignore' | 'error'

export interface IgnoreRange {
  start: number
  end: number
}

export interface IgnoreLineConfig {
  file: string
  lines?: number[]
  ranges?: IgnoreRange[]
}

export interface IgnoreCommentsConfig {
  currentLine: string
  nextLine: string
}

export interface NamespaceHookConfig {
  name: string
  namespaceArgIndex: number
}

export interface RemoveConfig {
  blockOnDynamicKeys: boolean
}

export interface I18nPrunerConfig {
  src?: string
  locale?: string
  protectedKeys?: string[]
  ignorePaths?: string[]
  ignoreLines?: IgnoreLineConfig[]
  ignoreComments?: Partial<IgnoreCommentsConfig>
  functionNames?: string[]
  transComponents?: string[]
  transKeyAttributes?: string[]
  namespaceHooks?: Array<Partial<NamespaceHookConfig> & { name: string }>
  dynamicKeyPolicy?: DynamicKeyPolicy
  remove?: Partial<RemoveConfig>
}

export interface ResolvedI18nPrunerConfig {
  src?: string
  locale?: string
  protectedKeys: string[]
  ignorePaths: string[]
  ignoreLines: IgnoreLineConfig[]
  ignoreComments: IgnoreCommentsConfig
  functionNames: string[]
  transComponents: string[]
  transKeyAttributes: string[]
  namespaceHooks: NamespaceHookConfig[]
  dynamicKeyPolicy: DynamicKeyPolicy
  remove: RemoveConfig
}

export interface UsedKeyLocation {
  file: string
  line: number
}

export interface ScanResult {
  usedKeys: Set<string>
  protectedKeys: Set<string>
  dynamicKeys: Array<{
    file: string
    line: number
    code: string
  }>
  usedKeyLocations: Map<string, UsedKeyLocation[]>
}
