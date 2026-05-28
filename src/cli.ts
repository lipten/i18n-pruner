#!/usr/bin/env node

import * as path from 'path'
import * as fs from 'fs'
import { Command } from 'commander'
import chalk from 'chalk'
import { scanProject } from './scan'
import { 
  loadLocaleKeys, 
  removeKeysFromLocales, 
  getLocaleFiles, 
  findKeyLocation,
  generateLocaleReports
} from './locale'

// Strip all ANSI escape sequences (colors + hyperlinks)
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\]8;[^\x1b]*\x1b\\/g, '').replace(/\x1b\\/g, '')
}

// Calculate visible width of a string
function visibleWidth(str: string): number {
  return stripAnsi(str).length
}

// padEnd that respects visible width (ignores ANSI codes)
function padEndVisible(str: string, targetWidth: number): string {
  const currentWidth = visibleWidth(str)
  if (currentWidth >= targetWidth) return str
  return str + ' '.repeat(targetWidth - currentWidth)
}

// padStart that respects visible width
function padStartVisible(str: string, targetWidth: number): string {
  const currentWidth = visibleWidth(str)
  if (currentWidth >= targetWidth) return str
  return ' '.repeat(targetWidth - currentWidth) + str
}

// Create a clickable file link for terminal
function createFileLink(filePath: string, line: number, displayText: string): string {
  const absolutePath = path.resolve(filePath)
  const fileUrl = `file://${absolutePath}:${line}:1`
  return `\x1b]8;;${fileUrl}\x1b\\${displayText}\x1b]8;;\x1b\\`
}

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
      if (files.some(f => f.endsWith('.json'))) {
        return dir
      }
    }
  }
  return 'locales'
}

// Render a complete locale report in a box
function renderLocaleReportBox(
  fileName: string,
  filePath: string,
  totalKeys: number,
  usedKeys: string[],
  unusedKeys: string[],
  missingKeys: string[],
  showUsed: boolean
): string {
  const lines: string[] = []
  const W = 62

  // Top border
  lines.push('╔' + '═'.repeat(W) + '╗')

  // Title centered
  const titleText = `📄 ${fileName}`
  const titleVisLen = visibleWidth(titleText)
  const titlePadL = Math.floor((W - titleVisLen) / 2)
  const titlePadR = W - titleVisLen - titlePadL
  lines.push('║' + ' '.repeat(titlePadL) + chalk.bold.cyan(titleText) + ' '.repeat(titlePadR) + '║')

  // Separator
  lines.push('╠' + '═'.repeat(W) + '╣')

  // Summary
  lines.push('║  ' + chalk.bold('Summary') + ' '.repeat(W - 10) + '║')
  lines.push('║  ' + '─'.repeat(W - 4) + '  ║')
  lines.push('║  ' + padEndVisible('Total Keys:', 16) + padStartVisible(String(totalKeys), 4) + ' '.repeat(W - 22) + '║')
  lines.push('║  ' + padEndVisible(chalk.green('Used:'), 16) + padStartVisible(chalk.green(String(usedKeys.length)), 4) + ' '.repeat(W - 22) + '║')
  lines.push('║  ' + padEndVisible(chalk.yellow('Unused:'), 16) + padStartVisible(chalk.yellow(String(unusedKeys.length)), 4) + ' '.repeat(W - 22) + '║')
  lines.push('║  ' + padEndVisible(chalk.red('Missing:'), 16) + padStartVisible(chalk.red(String(missingKeys.length)), 4) + ' '.repeat(W - 22) + '║')

  // Used Keys (only when --show-used)
  if (showUsed && usedKeys.length > 0) {
    lines.push('╠' + '═'.repeat(W) + '╣')
    lines.push('║  ' + chalk.green.bold('✓ Used Keys') + ' '.repeat(W - 14) + '║')
    lines.push('║  ' + '─'.repeat(W - 4) + '  ║')

    for (const key of usedKeys) {
      const location = findKeyLocation(filePath, key)
      const locText = location
        ? createFileLink(filePath, location.line, chalk.cyan(`${location.file}:${location.line}`))
        : chalk.gray('-')
      const content = '    ' + padEndVisible(key, 28) + locText
      lines.push('║' + padEndVisible(content, W) + '║')
    }
  }

  // Unused Keys
  if (unusedKeys.length > 0) {
    lines.push('╠' + '═'.repeat(W) + '╣')
    lines.push('║  ' + chalk.yellow.bold('✗ Unused Keys') + ' '.repeat(W - 16) + '║')
    lines.push('║  ' + '─'.repeat(W - 4) + '  ║')

    for (const key of unusedKeys) {
      const location = findKeyLocation(filePath, key)
      const locText = location
        ? createFileLink(filePath, location.line, chalk.cyan(`${location.file}:${location.line}`))
        : chalk.gray('-')
      const content = '    ' + padEndVisible(key, 28) + locText
      lines.push('║' + padEndVisible(content, W) + '║')
    }
  }

  // Missing Keys
  if (missingKeys.length > 0) {
    lines.push('╠' + '═'.repeat(W) + '╣')
    lines.push('║  ' + chalk.red.bold('⚠ Missing Keys') + ' '.repeat(W - 17) + '║')
    lines.push('║  ' + '─'.repeat(W - 4) + '  ║')

    for (const key of missingKeys) {
      const content = '    ' + key
      lines.push('║' + padEndVisible(content, W) + '║')
    }
  }

  // Bottom border
  lines.push('╚' + '═'.repeat(W) + '╝')

  return lines.join('\n')
}

const program = new Command()

program.name('i18n-pruner').description('🌳 AST-based i18n key pruning tool')

// ========================
// Scan Command
// ========================
program
  .command('scan')
  .description('Scan and audit i18n keys')
  .option('--src <path>', 'Source code directory', findDefaultSrc())
  .option('--locale <path>', 'Locale JSON files directory', findDefaultLocale())
  .option('--show-used', 'Show used keys in report', false)
  .action(async (options) => {
    console.log(chalk.bold.cyan('\n🌳 i18n Pruner\n'))

    // Validate paths exist
    if (!fs.existsSync(options.src)) {
      console.log(chalk.red(`✗ Source directory not found: ${options.src}`))
      console.log(chalk.gray('Use --src to specify the correct path'))
      process.exit(1)
    }
    if (!fs.existsSync(options.locale)) {
      console.log(chalk.red(`✗ Locale directory not found: ${options.locale}`))
      console.log(chalk.gray('Use --locale to specify the correct path'))
      process.exit(1)
    }

    const scanResult = await scanProject(options.src)
    const localeReports = generateLocaleReports(options.locale, scanResult.usedKeys)

    // Global summary
    const allKeys = loadLocaleKeys(options.locale)
    const allUnused = [...allKeys].filter((key) => !scanResult.usedKeys.has(key))

    const GW = 58
    console.log(chalk.bold('╔' + '═'.repeat(GW) + '╗'))
    console.log(chalk.bold('║') + chalk.bold.cyan(padEndVisible('GLOBAL SUMMARY', GW)) + chalk.bold('║'))
    console.log(chalk.bold('╠' + '═'.repeat(GW) + '╣'))
    console.log('║  ' + padEndVisible('Total Keys (all locales):', 30) + padStartVisible(String(allKeys.size), 6) + ' '.repeat(GW - 38) + '║')
    console.log('║  ' + padEndVisible(chalk.green('Used in Code:'), 30) + padStartVisible(chalk.green(String(scanResult.usedKeys.size)), 6) + ' '.repeat(GW - 38) + '║')
    console.log('║  ' + padEndVisible(chalk.yellow('Unused (all locales):'), 30) + padStartVisible(chalk.yellow(String(allUnused.length)), 6) + ' '.repeat(GW - 38) + '║')
    console.log('║  ' + padEndVisible(chalk.red('Dynamic Risk:'), 30) + padStartVisible(chalk.red(String(scanResult.dynamicKeys.length)), 6) + ' '.repeat(GW - 38) + '║')
    console.log(chalk.bold('╚' + '═'.repeat(GW) + '╝'))
    console.log()

    // Report for each locale file
    for (const report of localeReports) {
      console.log(renderLocaleReportBox(
        report.fileName,
        report.filePath,
        report.totalKeys,
        report.usedKeys,
        report.unusedKeys,
        report.missingKeys,
        options.showUsed
      ))
      console.log()
    }

    // Dynamic Keys (global)
    if (scanResult.dynamicKeys.length > 0) {
      const DW = 58
      console.log(chalk.bold('╔' + '═'.repeat(DW) + '╗'))
      console.log(chalk.bold('║') + chalk.red.bold(padEndVisible('⚠ Dynamic Keys (manual review required)', DW)) + chalk.bold('║'))
      console.log(chalk.bold('╠' + '═'.repeat(DW) + '╣'))

      for (let i = 0; i < scanResult.dynamicKeys.length; i++) {
        const dk = scanResult.dynamicKeys[i]
        const relativePath = path.relative(process.cwd(), dk.file)
        const locText = `${relativePath}:${dk.line}`
        const content = `  [${i}] ${padEndVisible(locText, 35)} ${dk.code}`
        console.log('║' + padEndVisible(content, DW) + '║')
      }

      console.log(chalk.bold('╚' + '═'.repeat(DW) + '╝'))
      console.log()
    }
  })

// ========================
// Remove Command
// ========================
program
  .command('remove')
  .description('Remove unused i18n keys from all locale files')
  .option('--src <path>', 'Source code directory', findDefaultSrc())
  .option('--locale <path>', 'Locale JSON files directory', findDefaultLocale())
  .option('-y, --yes', 'Skip confirmation prompt', false)
  .action(async (options) => {
    console.log(chalk.bold.cyan('\n🗑️  i18n Pruner - Remove\n'))

    // Validate paths exist
    if (!fs.existsSync(options.src)) {
      console.log(chalk.red(`✗ Source directory not found: ${options.src}`))
      console.log(chalk.gray('Use --src to specify the correct path'))
      process.exit(1)
    }
    if (!fs.existsSync(options.locale)) {
      console.log(chalk.red(`✗ Locale directory not found: ${options.locale}`))
      console.log(chalk.gray('Use --locale to specify the correct path'))
      process.exit(1)
    }

    const scanResult = await scanProject(options.src)
    const localeKeys = loadLocaleKeys(options.locale)
    const unusedKeys = [...localeKeys].filter((key) => !scanResult.usedKeys.has(key))

    if (unusedKeys.length === 0) {
      console.log(chalk.green('✓ No unused keys to remove\n'))
      return
    }

    // Show keys to remove by locale
    const localeReports = generateLocaleReports(options.locale, scanResult.usedKeys)
    
    for (const report of localeReports) {
      if (report.unusedKeys.length > 0) {
        console.log(renderLocaleReportBox(
          report.fileName,
          report.filePath,
          report.totalKeys,
          report.usedKeys,
          report.unusedKeys,
          report.missingKeys,
          false
        ))
        console.log()
      }
    }

    // Confirmation
    if (!options.yes) {
      console.log(chalk.bold(`\n⚠  This will modify ${getLocaleFiles(options.locale).length} locale file(s)`))
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
    console.log(chalk.bold('\n🔄 Removing keys...\n'))

    const removed = removeKeysFromLocales(options.locale, unusedKeys)

    // Show results
    console.log(chalk.green.bold(`✓ Successfully removed ${Object.keys(removed).length} key(s):\n`))

    // Group by file
    const byFile: Record<string, string[]> = {}
    for (const [key, info] of Object.entries(removed)) {
      if (!byFile[info.file]) byFile[info.file] = []
      byFile[info.file].push(key)
    }

    for (const [file, keys] of Object.entries(byFile)) {
      console.log(chalk.bold(`${file}:`))
      for (const key of keys.sort()) {
        console.log(chalk.gray(`  - ${key}`))
      }
    }

    console.log(chalk.green('\n✓ Done!\n'))
  })

program.parse()
