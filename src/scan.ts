import * as path from 'path'
import * as fs from 'fs'
import fg from 'fast-glob'
import { Node, Project } from 'ts-morph'
import { DEFAULT_CONFIG } from './config'
import { matchesAnyPathPattern, matchesPathPattern } from './match'
import type { ResolvedI18nPrunerConfig, ScanResult } from './types'

function findTsConfig(srcPath: string): string | undefined {
  // Check if tsconfig.json exists in the source directory
  const srcTsConfig = path.join(srcPath, 'tsconfig.json')
  if (fs.existsSync(srcTsConfig)) {
    return srcTsConfig
  }

  // Check parent directory
  const parentDir = path.dirname(srcPath)
  if (parentDir !== srcPath) {
    const parentTsConfig = path.join(parentDir, 'tsconfig.json')
    if (fs.existsSync(parentTsConfig)) {
      return parentTsConfig
    }
  }

  // Check current working directory
  const cwdTsConfig = path.resolve('tsconfig.json')
  if (fs.existsSync(cwdTsConfig)) {
    return cwdTsConfig
  }

  return undefined
}

function isIgnoredByLineConfig(
  filePath: string,
  line: number,
  config: ResolvedI18nPrunerConfig
): boolean {
  return config.ignoreLines.some((entry) => {
    if (!matchesPathPattern(filePath, entry.file)) return false

    if (entry.lines?.includes(line)) return true
    return entry.ranges?.some((range) => line >= range.start && line <= range.end) ?? false
  })
}

function hasIgnoreComment(sourceFile: import('ts-morph').SourceFile, line: number, config: ResolvedI18nPrunerConfig): boolean {
  const lines = sourceFile.getFullText().split(/\r?\n/)
  const currentLine = lines[line - 1] ?? ''
  const previousLine = lines[line - 2] ?? ''

  return (
    currentLine.includes(config.ignoreComments.currentLine) ||
    previousLine.includes(config.ignoreComments.nextLine)
  )
}

function shouldIgnoreHit(
  sourceFile: import('ts-morph').SourceFile,
  line: number,
  config: ResolvedI18nPrunerConfig
): boolean {
  return (
    isIgnoredByLineConfig(sourceFile.getFilePath(), line, config) ||
    hasIgnoreComment(sourceFile, line, config)
  )
}

function pushDynamicKey(
  dynamicKeys: ScanResult['dynamicKeys'],
  sourceFile: import('ts-morph').SourceFile,
  line: number,
  code: string,
  config: ResolvedI18nPrunerConfig
): void {
  if (config.dynamicKeyPolicy === 'ignore') return

  dynamicKeys.push({
    file: sourceFile.getFilePath(),
    line,
    code,
  })
}

export async function scanProject(
  src: string,
  scanConfig: ResolvedI18nPrunerConfig = DEFAULT_CONFIG
): Promise<ScanResult> {
  const srcPath = path.resolve(src)
  const tsConfigPath = findTsConfig(srcPath)
  const config = scanConfig

  const projectOptions: any = {}
  if (tsConfigPath) {
    projectOptions.tsConfigFilePath = tsConfigPath
  } else {
    // Fallback: create project without tsconfig
    projectOptions.compilerOptions = {
      target: 'ES2020',
      module: 'ESNext',
      jsx: 'react-jsx',
      esModuleInterop: true,
      skipLibCheck: true,
    }
  }

  const project = new Project(projectOptions)

  const files = (await fg([`${srcPath}/**/*.{ts,tsx,js,jsx}`]))
    .filter((file) => !matchesAnyPathPattern(file, config.ignorePaths))

  files.forEach((file) => {
    project.addSourceFileAtPath(file)
  })

  const usedKeys = new Set<string>()
  const protectedKeys = new Set<string>()
  const dynamicKeys: ScanResult['dynamicKeys'] = []

  for (const sourceFile of project.getSourceFiles()) {
    const translateMap = new Map<string, string>()

    sourceFile.forEachDescendant((node) => {
      // ========================
      // useTranslate('home')
      // const tt = useTranslate('home')
      // ========================
      if (Node.isVariableDeclaration(node)) {
        const initializer = node.getInitializer()

        if (initializer && Node.isCallExpression(initializer)) {
          const fnName = initializer.getExpression().getText()

          const namespaceHook = config.namespaceHooks.find((hook) => hook.name === fnName)

          if (namespaceHook) {
            const varName = node.getName()
            const arg = initializer.getArguments()[namespaceHook.namespaceArgIndex]

            if (arg && Node.isStringLiteral(arg)) {
              translateMap.set(varName, arg.getLiteralText())
            }
          }
        }
      }

      // ========================
      // t('aaa')
      // window.t('aaa')
      // tt('bbb')
      // ========================
      if (Node.isCallExpression(node)) {
        const expr = node.getExpression()
        const fnName = expr.getText()
        const args = node.getArguments()
        const firstArg = args[0]

        if (!firstArg) return

        const isTFunction = config.functionNames.includes(fnName) || translateMap.has(fnName)

        if (!isTFunction) return

        const line = firstArg.getStartLineNumber()
        if (shouldIgnoreHit(sourceFile, line, config)) return

        if (!Node.isStringLiteral(firstArg)) {
          pushDynamicKey(dynamicKeys, sourceFile, line, firstArg.getText(), config)
          return
        }

        let key = firstArg.getLiteralText()

        if (translateMap.has(fnName)) {
          key = `${translateMap.get(fnName)}.${key}`
        }

        usedKeys.add(key)
      }

      // ========================
      // <Trans i18nKey="aaa" />
      // ========================
      if (Node.isJsxSelfClosingElement(node) || Node.isJsxOpeningElement(node)) {
        const tagName = node.getTagNameNode().getText()

        if (!config.transComponents.includes(tagName)) return

        const attrs = node.getAttributes()

        for (const attr of attrs) {
          if (!Node.isJsxAttribute(attr)) continue

          const jsxAttr = attr
          const attrNameNode = jsxAttr.getNameNode()
          const attrName = attrNameNode.getText()

          if (!config.transKeyAttributes.includes(attrName)) continue

          const initializer = jsxAttr.getInitializer()
          if (!initializer) continue

          const line = initializer.getStartLineNumber()
          if (shouldIgnoreHit(sourceFile, line, config)) continue

          if (Node.isStringLiteral(initializer)) {
            usedKeys.add(initializer.getLiteralText())
          } else {
            pushDynamicKey(dynamicKeys, sourceFile, line, initializer.getText(), config)
          }
        }
      }
    })
  }

  return { usedKeys, protectedKeys, dynamicKeys }
}
