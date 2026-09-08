#!/usr/bin/env node

import * as path from 'path'
import * as fs from 'fs'
import { Command } from 'commander'
import chalk from 'chalk'
import { scanProject } from './scan'
import { loadConfig } from './config'
import { resolveProtectedKeys } from './match'
import { 
  loadLocaleKeys, 
  removeKeysFromLocales, 
  getLocaleFiles, 
  findKeyLocation,
  generateLocaleReports,
  expandUsedKeysFromLocaleSuffixes,
  loadNestedLocaleReferences,
  type MissingKeyLocation
} from './locale'

// No more file links, just plain text

// Find default source directory
function findDefaultSrc(): string {
  const candidates = ['src', 'app', 'lib', '.']
  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      return dir
    }
  }
  return '.'
}

// Find default locale directory
function findDefaultLocale(): string {
  const candidates = [
    'src/locales',
    'src/i18n',
    'locales',
    'i18n',
    'public/locales',
    'messages',
    'lang',
    'src/lang'
  ]
  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      // Check if it contains JSON files
      const files = fs.readdirSync(dir)
      const hasJsonFiles = files.some((f) => f.endsWith('.json'))
      const hasNamespacedJsonDirs = files.some((entry) => {
        const entryPath = path.join(dir, entry)
        if (!fs.existsSync(entryPath) || !fs.statSync(entryPath).isDirectory()) return false
        return fs.readdirSync(entryPath).some((child) => child.endsWith('.json'))
      })

      if (hasJsonFiles || hasNamespacedJsonDirs) {
        return dir
      }
    }
  }
  return 'locales'
}

// Print a separator line
function printSeparator(char: string = '─'): void {
  console.log(chalk.gray(char.repeat(60)))
}

// Print a section header
function printSectionHeader(title: string): void {
  console.log(chalk.bold.cyan(`\n▸ ${title}`))
  printSeparator()
}

// Render a clean locale report
function renderLocaleReport(
  fileName: string,
  filePath: string,
  totalKeys: number,
  usedKeys: string[],
  protectedKeys: string[],
  unusedKeys: string[],
  missingKeys: string[],
  missingKeyLocations: Map<string, MissingKeyLocation[]>,
  showUsed: boolean
): void {
  // File title
  console.log(chalk.bold.cyan(`\n📄 ${fileName}`))
  printSeparator()

  // Summary
  console.log(chalk.bold('  Summary'))
  console.log(`  ${chalk.gray('Total Keys:')}  ${totalKeys}`)
  console.log(`  ${chalk.green('Used:')}        ${usedKeys.length}`)
  console.log(`  ${chalk.blue('Protected:')}   ${protectedKeys.length}`)
  console.log(`  ${chalk.yellow('Unused:')}      ${unusedKeys.length}`)
  console.log(`  ${chalk.red('Missing:')}     ${missingKeys.length}`)

  // Used Keys (only when --show-used)
  if (showUsed && usedKeys.length > 0) {
    console.log()
    console.log(chalk.green.bold('  ✓ Used Keys'))
    for (const key of usedKeys) {
      const location = findKeyLocation(filePath, key)
      const locText = location
        ? chalk.cyan(`  ${location.file}:${location.line}`)
        : chalk.gray('  -')
      console.log(`    ${key} ${locText}`)
    }
  }

  // Protected Keys
  if (protectedKeys.length > 0) {
    console.log()
    console.log(chalk.blue.bold('  ◆ Protected Keys'))
    for (const key of protectedKeys) {
      const location = findKeyLocation(filePath, key)
      const locText = location
        ? chalk.cyan(`  ${location.file}:${location.line}`)
        : chalk.gray('  -')
      console.log(`    ${key} ${locText}`)
    }
  }

  // Unused Keys
  if (unusedKeys.length > 0) {
    console.log()
    console.log(chalk.yellow.bold('  ✗ Unused Keys'))
    for (const key of unusedKeys) {
      const location = findKeyLocation(filePath, key)
      const locText = location
        ? chalk.cyan(`  ${location.file}:${location.line}`)
        : chalk.gray('  -')
      console.log(`    ${key} ${locText}`)
    }
  }

  // Missing Keys
  if (missingKeys.length > 0) {
    console.log()
    console.log(chalk.red.bold('  ⚠ Missing Keys'))
    for (const key of missingKeys) {
      const locations = missingKeyLocations.get(key)
      if (locations && locations.length > 0) {
        const relativePath = path.relative(process.cwd(), locations[0].file)
        const locText = chalk.cyan(`  ${relativePath}:${locations[0].line}`)
        if (locations.length > 1) {
          console.log(`    ${key} ${locText} ${chalk.gray(`(+${locations.length - 1})`)}`)
        } else {
          console.log(`    ${key} ${locText}`)
        }
      } else {
        console.log(`    ${key}`)
      }
    }
  }
}

function selectLocaleReports<T extends { fileName: string }>(reports: T[], showAllLocales: boolean): T[] {
  if (showAllLocales) return reports

  const englishReport = reports.find((report) => report.fileName === 'en.json')
  return englishReport ? [englishReport] : reports.slice(0, 1)
}

function resolveRuntimeOptions(options: { src?: string; locale?: string; config?: string }) {
  let loaded: ReturnType<typeof loadConfig>
  try {
    loaded = loadConfig(options.config)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.log(chalk.red(`\n✗ ${message}\n`))
    process.exit(1)
  }

  const src = options.src ?? loaded.config.src ?? findDefaultSrc()
  const locale = options.locale ?? loaded.config.locale ?? findDefaultLocale()

  return {
    config: loaded.config,
    configPath: loaded.configPath,
    src,
    locale,
  }
}

function printDynamicKeys(dynamicKeys: Array<{ file: string; line: number; code: string }>): void {
  if (dynamicKeys.length === 0) return

  console.log()
  printSectionHeader('Dynamic Keys (manual review required)')
  for (let i = 0; i < dynamicKeys.length; i++) {
    const dk = dynamicKeys[i]
    const relativePath = path.relative(process.cwd(), dk.file)
    const locText = chalk.cyan(`${relativePath}:${dk.line}`)
    console.log(`  [${i}] ${locText}`)
    console.log(`      ${chalk.gray(dk.code)}`)
  }
}

function exitOnDynamicPolicy(
  dynamicKeys: Array<{ file: string; line: number; code: string }>,
  policy: string
): void {
  if (policy === 'error' && dynamicKeys.length > 0) {
    console.log(chalk.red('\n✗ Dynamic i18n keys found and dynamicKeyPolicy is set to "error"\n'))
    process.exit(1)
  }
}

const program = new Command()

program.name('i18n-pruner').description('🌳 AST-based i18n key pruning tool')

// ========================
// Scan Command
// ========================
program
  .command('scan')
  .description('Scan and audit i18n keys')
  .option('--src <path>', 'Source code directory')
  .option('--locale <path>', 'Locale JSON files directory')
  .option('--config <path>', 'Path to i18n-pruner.config.json')
  .option('--show-used', 'Show used keys in report', false)
  .option('--all-locales', 'Show reports for all locale files', false)
  .action(async (options) => {
    console.log(chalk.bold.cyan('\n🌳 i18n Pruner'))
    const runtime = resolveRuntimeOptions(options)

    // Validate paths exist
    if (!fs.existsSync(runtime.src)) {
      console.log(chalk.red(`\n✗ Source directory not found: ${runtime.src}`))
      console.log(chalk.gray('Use --src to specify the correct path\n'))
      process.exit(1)
    }
    if (!fs.existsSync(runtime.locale)) {
      console.log(chalk.red(`\n✗ Locale directory not found: ${runtime.locale}`))
      console.log(chalk.gray('Use --locale to specify the correct path\n'))
      process.exit(1)
    }

    // Global summary
    const allKeys = loadLocaleKeys(runtime.locale)
    const protectedKeys = resolveProtectedKeys(allKeys, runtime.config.protectedKeys)
    const scanResult = await scanProject(runtime.src, runtime.config)
    scanResult.protectedKeys = protectedKeys

    const nestedLocaleReferences = loadNestedLocaleReferences(runtime.locale)
    const codeAndNestedUsedKeys = new Set([...scanResult.usedKeys, ...nestedLocaleReferences])
    const reportUsedKeys = expandUsedKeysFromLocaleSuffixes(allKeys, codeAndNestedUsedKeys)
    const effectiveUsedKeys = new Set([...reportUsedKeys, ...protectedKeys])
    const localeReports = generateLocaleReports(runtime.locale, reportUsedKeys, protectedKeys, scanResult.usedKeyLocations)
    const allUnused = [...allKeys].filter((key) => !effectiveUsedKeys.has(key))

    printSectionHeader('Global Summary')
    console.log(`  ${chalk.gray('Total Keys (all locales):')}  ${allKeys.size}`)
    console.log(`  ${chalk.green('Used in Code:')}              ${scanResult.usedKeys.size}`)
    console.log(`  ${chalk.blue('Protected by Config:')}       ${protectedKeys.size}`)
    console.log(`  ${chalk.yellow('Unused (all locales):')}      ${allUnused.length}`)
    console.log(`  ${chalk.red('Dynamic Risk:')}               ${scanResult.dynamicKeys.length}`)

    // Report for each locale file
    for (const report of selectLocaleReports(localeReports, options.allLocales)) {
      renderLocaleReport(
        report.fileName,
        report.filePath,
        report.totalKeys,
        report.usedKeys,
        report.protectedKeys,
        report.unusedKeys,
        report.missingKeys,
        report.missingKeyLocations,
        options.showUsed
      )
    }

    // Dynamic Keys (global)
    printDynamicKeys(scanResult.dynamicKeys)
    exitOnDynamicPolicy(scanResult.dynamicKeys, runtime.config.dynamicKeyPolicy)

    console.log()
  })

// ========================
// Remove Command
// ========================
program
  .command('remove')
  .description('Remove unused i18n keys from all locale files')
  .option('--src <path>', 'Source code directory')
  .option('--locale <path>', 'Locale JSON files directory')
  .option('--config <path>', 'Path to i18n-pruner.config.json')
  .option('-y, --yes', 'Skip confirmation prompt', false)
  .option('--all-locales', 'Show reports for all locale files', false)
  .action(async (options) => {
    console.log(chalk.bold.cyan('\n🗑️  i18n Pruner - Remove'))
    const runtime = resolveRuntimeOptions(options)

    // Validate paths exist
    if (!fs.existsSync(runtime.src)) {
      console.log(chalk.red(`\n✗ Source directory not found: ${runtime.src}`))
      console.log(chalk.gray('Use --src to specify the correct path\n'))
      process.exit(1)
    }
    if (!fs.existsSync(runtime.locale)) {
      console.log(chalk.red(`\n✗ Locale directory not found: ${runtime.locale}`))
      console.log(chalk.gray('Use --locale to specify the correct path\n'))
      process.exit(1)
    }

    const scanResult = await scanProject(runtime.src, runtime.config)
    const localeKeys = loadLocaleKeys(runtime.locale)
    const protectedKeys = resolveProtectedKeys(localeKeys, runtime.config.protectedKeys)
    scanResult.protectedKeys = protectedKeys

    printDynamicKeys(scanResult.dynamicKeys)
    exitOnDynamicPolicy(scanResult.dynamicKeys, runtime.config.dynamicKeyPolicy)

    if (
      runtime.config.dynamicKeyPolicy !== 'ignore' &&
      runtime.config.remove.blockOnDynamicKeys &&
      scanResult.dynamicKeys.length > 0
    ) {
      console.log(chalk.red('\n✗ Dynamic i18n keys found and remove.blockOnDynamicKeys is enabled\n'))
      process.exit(1)
    }

    const nestedLocaleReferences = loadNestedLocaleReferences(runtime.locale)
    const codeAndNestedUsedKeys = new Set([...scanResult.usedKeys, ...nestedLocaleReferences])
    const reportUsedKeys = expandUsedKeysFromLocaleSuffixes(localeKeys, codeAndNestedUsedKeys)
    const effectiveUsedKeys = new Set([...reportUsedKeys, ...protectedKeys])
    const unusedKeys = [...localeKeys].filter((key) => !effectiveUsedKeys.has(key))

    if (unusedKeys.length === 0) {
      console.log(chalk.green('\n✓ No unused keys to remove\n'))
      return
    }

    // Show keys to remove by locale
    const localeReports = generateLocaleReports(runtime.locale, reportUsedKeys, protectedKeys, scanResult.usedKeyLocations)
    
    for (const report of selectLocaleReports(localeReports, options.allLocales)) {
      renderLocaleReport(
        report.fileName,
        report.filePath,
        report.totalKeys,
        report.usedKeys,
        report.protectedKeys,
        report.unusedKeys,
        report.missingKeys,
        report.missingKeyLocations,
        false
      )
    }

    // Confirmation
    if (!options.yes) {
      console.log(chalk.bold(`\n⚠  This will modify ${getLocaleFiles(runtime.locale).length} locale file(s)`))
      const readline = await import('readline')
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      const answer = await new Promise<string>((resolve) =>
        rl.question(chalk.bold('\n❓ Proceed with removal? (y/N): '), resolve)
      )
      rl.close()

      if (answer.toLowerCase() !== 'y') {
        console.log(chalk.gray('\n✗ Cancelled\n'))
        return
      }
    }

    // Perform removal
    console.log(chalk.bold('\n🔄 Removing keys...'))

    const removed = removeKeysFromLocales(runtime.locale, unusedKeys)

    // Show results
    console.log(chalk.green.bold(`\n✓ Successfully removed ${Object.keys(removed).length} key(s):`))

    // Group by file
    const byFile: Record<string, string[]> = {}
    for (const [key, info] of Object.entries(removed)) {
      if (!byFile[info.file]) byFile[info.file] = []
      byFile[info.file].push(key)
    }

    for (const [file, keys] of Object.entries(byFile)) {
      console.log(`\n${chalk.bold(file)}:`)
      for (const key of keys.sort()) {
        console.log(chalk.gray(`  - ${key}`))
      }
    }

    console.log(chalk.green('\n✓ Done!\n'))
  })

program.parse()
