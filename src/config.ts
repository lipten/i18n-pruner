import * as fs from 'fs'
import * as path from 'path'
import type { I18nPrunerConfig, ResolvedI18nPrunerConfig } from './types'

export const DEFAULT_CONFIG_FILE = 'i18n-pruner.config.json'

export const DEFAULT_CONFIG: ResolvedI18nPrunerConfig = {
  protectedKeys: [],
  ignorePaths: [],
  ignoreLines: [],
  ignoreComments: {
    currentLine: 'i18n-pruner-ignore-line',
    nextLine: 'i18n-pruner-ignore-next-line',
  },
  functionNames: ['t', 'window.t', '$t'],
  transComponents: ['Trans'],
  transKeyAttributes: ['i18nKey'],
  namespaceHooks: [{ name: 'useTranslate', namespaceArgIndex: 0 }],
  dynamicKeyPolicy: 'warn',
  remove: {
    blockOnDynamicKeys: false,
  },
}

export interface LoadedConfig {
  config: ResolvedI18nPrunerConfig
  configPath?: string
}

function readJsonConfig(configPath: string): I18nPrunerConfig {
  const content = fs.readFileSync(configPath, 'utf-8')
  return JSON.parse(content) as I18nPrunerConfig
}

function normalizeConfig(config: I18nPrunerConfig): ResolvedI18nPrunerConfig {
  return {
    src: config.src,
    locale: config.locale,
    protectedKeys: config.protectedKeys ?? DEFAULT_CONFIG.protectedKeys,
    ignorePaths: config.ignorePaths ?? DEFAULT_CONFIG.ignorePaths,
    ignoreLines: config.ignoreLines ?? DEFAULT_CONFIG.ignoreLines,
    ignoreComments: {
      ...DEFAULT_CONFIG.ignoreComments,
      ...(config.ignoreComments ?? {}),
    },
    functionNames: config.functionNames ?? DEFAULT_CONFIG.functionNames,
    transComponents: config.transComponents ?? DEFAULT_CONFIG.transComponents,
    transKeyAttributes: config.transKeyAttributes ?? DEFAULT_CONFIG.transKeyAttributes,
    namespaceHooks: (config.namespaceHooks ?? DEFAULT_CONFIG.namespaceHooks).map((hook) => ({
      name: hook.name,
      namespaceArgIndex: hook.namespaceArgIndex ?? 0,
    })),
    dynamicKeyPolicy: config.dynamicKeyPolicy ?? DEFAULT_CONFIG.dynamicKeyPolicy,
    remove: {
      ...DEFAULT_CONFIG.remove,
      ...(config.remove ?? {}),
    },
  }
}

export function loadConfig(configPath?: string): LoadedConfig {
  const resolvedPath = configPath
    ? path.resolve(configPath)
    : path.resolve(DEFAULT_CONFIG_FILE)

  if (!fs.existsSync(resolvedPath)) {
    if (configPath) {
      throw new Error(`Config file not found: ${configPath}`)
    }
    return { config: DEFAULT_CONFIG }
  }

  return {
    config: normalizeConfig(readJsonConfig(resolvedPath)),
    configPath: resolvedPath,
  }
}
