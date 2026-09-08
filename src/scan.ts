import * as path from 'path'
import * as fs from 'fs'
import fg from 'fast-glob'
import { Node, Project, SyntaxKind } from 'ts-morph'
import { DEFAULT_CONFIG } from './config'
import { matchesAnyPathPattern, matchesPathPattern } from './match'
import type { ResolvedI18nPrunerConfig, ScanResult, UsedKeyLocation } from './types'

interface TranslationBinding {
  namespace?: string
  keyPrefix?: string
}

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

function recordKeyLocation(
  usedKeyLocations: Map<string, UsedKeyLocation[]>,
  key: string,
  file: string,
  line: number
): void {
  const location: UsedKeyLocation = { file, line }
  const existing = usedKeyLocations.get(key)
  if (existing) {
    existing.push(location)
  } else {
    usedKeyLocations.set(key, [location])
  }
}

function normalizeTranslationKey(key: string, namespace?: string, keyPrefix?: string): string {
  if (key.includes(':')) {
    const [explicitNamespace, rest] = key.split(':', 2)
    return `${explicitNamespace}.${rest}`
  }

  const keyWithPrefix = keyPrefix ? `${keyPrefix}.${key}` : key
  return namespace ? `${namespace}.${keyWithPrefix}` : keyWithPrefix
}

function readStringLiteral(node?: import('ts-morph').Node): string | undefined {
  if (!node) return undefined
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralText()
  }
  return undefined
}

function getStaticStringFromExpression(node?: import('ts-morph').Node): string | undefined {
  if (!node) return undefined
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralText()
  }
  if (!Node.isJsxExpression(node)) {
    return undefined
  }

  const expression = node.getExpression()
  if (!expression) return undefined
  return readStringLiteral(expression)
}

function getNamespaceFromUseTranslationCall(initializer: import('ts-morph').CallExpression): string | undefined {
  const arg = initializer.getArguments()[0]
  const directNamespace = readStringLiteral(arg)
  if (directNamespace !== undefined) return directNamespace

  if (!arg || !Node.isArrayLiteralExpression(arg)) {
    return undefined
  }

  const firstElement = arg.getElements()[0]
  return firstElement && Node.isStringLiteral(firstElement) ? firstElement.getLiteralText() : undefined
}

function getKeyPrefixFromOptionsArg(initializer: import('ts-morph').CallExpression): string | undefined {
  const optionsArg = initializer.getArguments().find(Node.isObjectLiteralExpression)
  if (!optionsArg) return undefined

  for (const property of optionsArg.getProperties()) {
    if (!Node.isPropertyAssignment(property)) continue
    if (property.getName() !== 'keyPrefix') continue

    return readStringLiteral(property.getInitializer())
  }

  return undefined
}

function getNamespaceOverride(args: import('ts-morph').Node[]): string | undefined {
  const optionsArg = args.find(Node.isObjectLiteralExpression)
  if (!optionsArg) return undefined

  for (const property of optionsArg.getProperties()) {
    if (!Node.isPropertyAssignment(property)) continue
    if (property.getName() !== 'ns') continue

    return readStringLiteral(property.getInitializer())
  }

  return undefined
}

function getWrapperFunctionBodyCall(initializer: import('ts-morph').Expression): import('ts-morph').CallExpression | undefined {
  if (!Node.isArrowFunction(initializer) && !Node.isFunctionExpression(initializer)) {
    return undefined
  }

  const body = initializer.getBody()
  if (Node.isCallExpression(body)) {
    return body
  }

  if (Node.isBlock(body)) {
    const statements = body.getStatements()
    if (statements.length !== 1) return undefined

    const statement = statements[0]
    if (!Node.isReturnStatement(statement)) return undefined

    const expression = statement.getExpression()
    return expression && Node.isCallExpression(expression) ? expression : undefined
  }

  return undefined
}

function isSimpleTranslateWrapperCall(
  node: import('ts-morph').CallExpression,
  config: ResolvedI18nPrunerConfig
): boolean {
  const declaration = node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)
  if (!declaration) return false

  const wrapperName = declaration.getName()
  if (!config.functionNames.includes(wrapperName)) return false

  const initializer = declaration.getInitializer()
  if (!initializer) return false

  const wrappedCall = getWrapperFunctionBodyCall(initializer)
  if (wrappedCall !== node) return false

  const targetName = wrappedCall.getExpression().getText()
  if (!config.functionNames.includes(targetName)) return false
  if (targetName === wrapperName) return false

  const parameters = Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)
    ? initializer.getParameters().map((param) => param.getName())
    : []

  const args = wrappedCall.getArguments()
  return args.length > 0 && args.every((arg) => Node.isIdentifier(arg) && parameters.includes(arg.getText()))
}

function getStaticStringFromJsxInitializer(initializer?: import('ts-morph').Node): string | undefined {
  return getStaticStringFromExpression(initializer)
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
  const usedKeyLocations = new Map<string, UsedKeyLocation[]>()

  for (const sourceFile of project.getSourceFiles()) {
    const translateMap = new Map<string, string>()
    const translationBindingMap = new Map<string, TranslationBinding>()
    const fileWithTranslationNamespaces: string[] = []

    sourceFile.forEachDescendant((node) => {
      // ========================
      // withTranslation("namespace")(Component)
      // 记录高阶组件的 namespace 到文件级别
      // ========================
      if (Node.isCallExpression(node)) {
        const expr = node.getExpression()
        if (Node.isIdentifier(expr) && expr.getText() === 'withTranslation') {
          const args = node.getArguments()
          if (args.length > 0) {
            const namespace = readStringLiteral(args[0])
            if (namespace) {
              fileWithTranslationNamespaces.push(namespace)
            }
          }
        }
      }
    })

    sourceFile.forEachDescendant((node) => {
      // ========================
      // useTranslate('home')
      // const tt = useTranslate('home')
      // ========================
      if (Node.isVariableDeclaration(node)) {
        const initializer = node.getInitializer()

        if (initializer && Node.isCallExpression(initializer)) {
          const fnName = initializer.getExpression().getText()

          if (fnName === 'useTranslation') {
            const namespace = getNamespaceFromUseTranslationCall(initializer)
            const keyPrefix = getKeyPrefixFromOptionsArg(initializer)
            const nameNode = node.getNameNode()

            if (Node.isObjectBindingPattern(nameNode)) {
              nameNode.getElements().forEach((element) => {
                const propertyName = element.getPropertyNameNode()?.getText() ?? element.getName()
                if (propertyName !== 't') return
                translationBindingMap.set(element.getName(), { namespace, keyPrefix })
              })
            }
          }

          const namespaceHook = config.namespaceHooks.find((hook) => hook.name === fnName)

          if (namespaceHook) {
            const varName = node.getName()
            const arg = initializer.getArguments()[namespaceHook.namespaceArgIndex]
            const namespace = readStringLiteral(arg)

            if (namespace !== undefined) {
              translateMap.set(varName, namespace)
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

        const translationBinding = translationBindingMap.get(fnName)
        const isTFunction = config.functionNames.includes(fnName) || translateMap.has(fnName) || translationBinding !== undefined

        if (!isTFunction) return

        const line = firstArg.getStartLineNumber()
        if (shouldIgnoreHit(sourceFile, line, config)) return
        if (isSimpleTranslateWrapperCall(node, config)) return

        if (Node.isArrayLiteralExpression(firstArg)) {
          const elements = firstArg.getElements()
          const literalKeys = elements
            .map((element) => readStringLiteral(element))
            .filter((key): key is string => key !== undefined)
          const namespace = getNamespaceOverride(args) ?? translationBinding?.namespace
          const keyPrefix = translationBinding?.keyPrefix

          if (literalKeys.length === elements.length) {
            literalKeys.forEach((key) => {
              const normalizedKey = normalizeTranslationKey(key, namespace, keyPrefix)
              usedKeys.add(normalizedKey)
              recordKeyLocation(usedKeyLocations, normalizedKey, sourceFile.getFilePath(), line)
            })
          } else {
            pushDynamicKey(dynamicKeys, sourceFile, line, firstArg.getText(), config)
          }
          return
        }

        const staticFirstArg = readStringLiteral(firstArg)
        if (staticFirstArg === undefined) {
          pushDynamicKey(dynamicKeys, sourceFile, line, firstArg.getText(), config)
          return
        }

        let key = staticFirstArg
        const namespaceOverride = getNamespaceOverride(args)
        const hocNamespace = translationBinding?.namespace

        if (translateMap.has(fnName)) {
          key = `${translateMap.get(fnName)}.${key}`
        } else if (!namespaceOverride && !hocNamespace && fileWithTranslationNamespaces.length > 0) {
          // 使用 withTranslation 指定的第一个 namespace
          key = `${fileWithTranslationNamespaces[0]}.${key}`
        } else if (!translateMap.has(fnName)) {
          key = normalizeTranslationKey(
            key,
            namespaceOverride ?? hocNamespace,
            translationBinding?.keyPrefix
          )
        }

        usedKeys.add(key)
        recordKeyLocation(usedKeyLocations, key, sourceFile.getFilePath(), line)
      }

      // ========================
      // <Trans i18nKey="aaa" />
      // ========================
      if (Node.isJsxSelfClosingElement(node) || Node.isJsxOpeningElement(node)) {
        const tagName = node.getTagNameNode().getText()

        if (!config.transComponents.includes(tagName)) return

        const attrs = node.getAttributes()
        const namespaceAttr = attrs.find((attr) => Node.isJsxAttribute(attr) && attr.getNameNode().getText() === 'ns')
        const namespace = Node.isJsxAttribute(namespaceAttr)
          ? getStaticStringFromJsxInitializer(namespaceAttr.getInitializer())
          : undefined

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

          const staticKey = getStaticStringFromJsxInitializer(initializer)
          if (staticKey !== undefined) {
            const normalizedKey = normalizeTranslationKey(staticKey, namespace)
            usedKeys.add(normalizedKey)
            recordKeyLocation(usedKeyLocations, normalizedKey, sourceFile.getFilePath(), line)
          } else {
            pushDynamicKey(dynamicKeys, sourceFile, line, initializer.getText(), config)
          }
        }
      }
    })
  }

  return { usedKeys, protectedKeys, dynamicKeys, usedKeyLocations }
}
