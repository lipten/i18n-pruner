import * as path from 'path'
import * as fs from 'fs'
import fg from 'fast-glob'
import { Node, Project } from 'ts-morph'
import type { ScanResult } from './types'

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

export async function scanProject(src: string): Promise<ScanResult> {
  const srcPath = path.resolve(src)
  const tsConfigPath = findTsConfig(srcPath)

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

  const files = await fg([`${srcPath}/**/*.{ts,tsx,js,jsx}`])

  files.forEach((file) => {
    project.addSourceFileAtPath(file)
  })

  const usedKeys = new Set<string>()
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

          if (fnName === 'useTranslate') {
            const varName = node.getName()
            const arg = initializer.getArguments()[0]

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

        const isTFunction = fnName === 't' || fnName === 'window.t' || translateMap.has(fnName)

        if (!isTFunction) return

        if (!Node.isStringLiteral(firstArg)) {
          dynamicKeys.push({
            file: sourceFile.getFilePath(),
            line: firstArg.getStartLineNumber(),
            code: firstArg.getText(),
          })
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

        if (tagName !== 'Trans') return

        const attrs = node.getAttributes()

        for (const attr of attrs) {
          if (!Node.isJsxAttribute(attr)) continue

          const jsxAttr = attr
          const attrNameNode = jsxAttr.getNameNode()
          const attrName = attrNameNode.getText()

          if (attrName !== 'i18nKey') continue

          const initializer = jsxAttr.getInitializer()
          if (!initializer) continue

          if (Node.isStringLiteral(initializer)) {
            usedKeys.add(initializer.getLiteralText())
          } else {
            dynamicKeys.push({
              file: sourceFile.getFilePath(),
              line: initializer.getStartLineNumber(),
              code: initializer.getText(),
            })
          }
        }
      }
    })
  }

  return { usedKeys, dynamicKeys }
}
