#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const scan_1 = require("./scan");
const locale_1 = require("./locale");
// Strip all ANSI escape sequences (colors + hyperlinks)
function stripAnsi(str) {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\]8;[^\x1b]*\x1b\\/g, '').replace(/\x1b\\/g, '');
}
// Calculate visible width of a string
function visibleWidth(str) {
    return stripAnsi(str).length;
}
// padEnd that respects visible width (ignores ANSI codes)
function padEndVisible(str, targetWidth) {
    const currentWidth = visibleWidth(str);
    if (currentWidth >= targetWidth)
        return str;
    return str + ' '.repeat(targetWidth - currentWidth);
}
// padStart that respects visible width
function padStartVisible(str, targetWidth) {
    const currentWidth = visibleWidth(str);
    if (currentWidth >= targetWidth)
        return str;
    return ' '.repeat(targetWidth - currentWidth) + str;
}
// Create a clickable file link for terminal
function createFileLink(filePath, line, displayText) {
    const absolutePath = path.resolve(filePath);
    const fileUrl = `file://${absolutePath}:${line}:1`;
    return `\x1b]8;;${fileUrl}\x1b\\${displayText}\x1b]8;;\x1b\\`;
}
// Render a complete locale report in a box
function renderLocaleReportBox(fileName, filePath, totalKeys, usedKeys, unusedKeys, missingKeys, showUsed) {
    const lines = [];
    const W = 62;
    // Top border
    lines.push('╔' + '═'.repeat(W) + '╗');
    // Title centered
    const titleText = `📄 ${fileName}`;
    const titleVisLen = visibleWidth(titleText);
    const titlePadL = Math.floor((W - titleVisLen) / 2);
    const titlePadR = W - titleVisLen - titlePadL;
    lines.push('║' + ' '.repeat(titlePadL) + chalk_1.default.bold.cyan(titleText) + ' '.repeat(titlePadR) + '║');
    // Separator
    lines.push('╠' + '═'.repeat(W) + '╣');
    // Summary
    lines.push('║  ' + chalk_1.default.bold('Summary') + ' '.repeat(W - 10) + '║');
    lines.push('║  ' + '─'.repeat(W - 4) + '  ║');
    lines.push('║  ' + padEndVisible('Total Keys:', 16) + padStartVisible(String(totalKeys), 4) + ' '.repeat(W - 22) + '║');
    lines.push('║  ' + padEndVisible(chalk_1.default.green('Used:'), 16) + padStartVisible(chalk_1.default.green(String(usedKeys.length)), 4) + ' '.repeat(W - 22) + '║');
    lines.push('║  ' + padEndVisible(chalk_1.default.yellow('Unused:'), 16) + padStartVisible(chalk_1.default.yellow(String(unusedKeys.length)), 4) + ' '.repeat(W - 22) + '║');
    lines.push('║  ' + padEndVisible(chalk_1.default.red('Missing:'), 16) + padStartVisible(chalk_1.default.red(String(missingKeys.length)), 4) + ' '.repeat(W - 22) + '║');
    // Used Keys (only when --show-used)
    if (showUsed && usedKeys.length > 0) {
        lines.push('╠' + '═'.repeat(W) + '╣');
        lines.push('║  ' + chalk_1.default.green.bold('✓ Used Keys') + ' '.repeat(W - 14) + '║');
        lines.push('║  ' + '─'.repeat(W - 4) + '  ║');
        for (const key of usedKeys) {
            const location = (0, locale_1.findKeyLocation)(filePath, key);
            const locText = location
                ? createFileLink(filePath, location.line, chalk_1.default.cyan(`${location.file}:${location.line}`))
                : chalk_1.default.gray('-');
            const content = '    ' + padEndVisible(key, 28) + locText;
            lines.push('║' + padEndVisible(content, W) + '║');
        }
    }
    // Unused Keys
    if (unusedKeys.length > 0) {
        lines.push('╠' + '═'.repeat(W) + '╣');
        lines.push('║  ' + chalk_1.default.yellow.bold('✗ Unused Keys') + ' '.repeat(W - 16) + '║');
        lines.push('║  ' + '─'.repeat(W - 4) + '  ║');
        for (const key of unusedKeys) {
            const location = (0, locale_1.findKeyLocation)(filePath, key);
            const locText = location
                ? createFileLink(filePath, location.line, chalk_1.default.cyan(`${location.file}:${location.line}`))
                : chalk_1.default.gray('-');
            const content = '    ' + padEndVisible(key, 28) + locText;
            lines.push('║' + padEndVisible(content, W) + '║');
        }
    }
    // Missing Keys
    if (missingKeys.length > 0) {
        lines.push('╠' + '═'.repeat(W) + '╣');
        lines.push('║  ' + chalk_1.default.red.bold('⚠ Missing Keys') + ' '.repeat(W - 17) + '║');
        lines.push('║  ' + '─'.repeat(W - 4) + '  ║');
        for (const key of missingKeys) {
            const content = '    ' + key;
            lines.push('║' + padEndVisible(content, W) + '║');
        }
    }
    // Bottom border
    lines.push('╚' + '═'.repeat(W) + '╝');
    return lines.join('\n');
}
const program = new commander_1.Command();
program.name('i18n-tree-shaking').description('🌲 AST-based i18n key tree-shaking tool');
// ========================
// Scan Command
// ========================
program
    .command('scan')
    .description('Scan and audit i18n keys')
    .requiredOption('--src <path>', 'Source code directory')
    .requiredOption('--locale <path>', 'Locale files directory')
    .option('--show-used', 'Show used keys in report', false)
    .action(async (options) => {
    console.log(chalk_1.default.bold.cyan('\n🌳 i18n Pruner\n'));
    const scanResult = await (0, scan_1.scanProject)(options.src);
    const localeReports = (0, locale_1.generateLocaleReports)(options.locale, scanResult.usedKeys);
    // Global summary
    const allKeys = (0, locale_1.loadLocaleKeys)(options.locale);
    const allUnused = [...allKeys].filter((key) => !scanResult.usedKeys.has(key));
    const GW = 58;
    console.log(chalk_1.default.bold('╔' + '═'.repeat(GW) + '╗'));
    console.log(chalk_1.default.bold('║') + chalk_1.default.bold.cyan(padEndVisible('GLOBAL SUMMARY', GW)) + chalk_1.default.bold('║'));
    console.log(chalk_1.default.bold('╠' + '═'.repeat(GW) + '╣'));
    console.log('║  ' + padEndVisible('Total Keys (all locales):', 30) + padStartVisible(String(allKeys.size), 6) + ' '.repeat(GW - 38) + '║');
    console.log('║  ' + padEndVisible(chalk_1.default.green('Used in Code:'), 30) + padStartVisible(chalk_1.default.green(String(scanResult.usedKeys.size)), 6) + ' '.repeat(GW - 38) + '║');
    console.log('║  ' + padEndVisible(chalk_1.default.yellow('Unused (all locales):'), 30) + padStartVisible(chalk_1.default.yellow(String(allUnused.length)), 6) + ' '.repeat(GW - 38) + '║');
    console.log('║  ' + padEndVisible(chalk_1.default.red('Dynamic Risk:'), 30) + padStartVisible(chalk_1.default.red(String(scanResult.dynamicKeys.length)), 6) + ' '.repeat(GW - 38) + '║');
    console.log(chalk_1.default.bold('╚' + '═'.repeat(GW) + '╝'));
    console.log();
    // Report for each locale file
    for (const report of localeReports) {
        console.log(renderLocaleReportBox(report.fileName, report.filePath, report.totalKeys, report.usedKeys, report.unusedKeys, report.missingKeys, options.showUsed));
        console.log();
    }
    // Dynamic Keys (global)
    if (scanResult.dynamicKeys.length > 0) {
        const DW = 58;
        console.log(chalk_1.default.bold('╔' + '═'.repeat(DW) + '╗'));
        console.log(chalk_1.default.bold('║') + chalk_1.default.red.bold(padEndVisible('⚠ Dynamic Keys (manual review required)', DW)) + chalk_1.default.bold('║'));
        console.log(chalk_1.default.bold('╠' + '═'.repeat(DW) + '╣'));
        for (let i = 0; i < scanResult.dynamicKeys.length; i++) {
            const dk = scanResult.dynamicKeys[i];
            const locText = `${dk.file.split('/').pop() || dk.file}:${dk.line}`;
            const content = `  [${i}] ${padEndVisible(locText, 25)} ${dk.code}`;
            console.log('║' + padEndVisible(content, DW) + '║');
        }
        console.log(chalk_1.default.bold('╚' + '═'.repeat(DW) + '╝'));
        console.log();
    }
});
// ========================
// Remove Command
// ========================
program
    .command('remove')
    .description('Remove unused i18n keys from all locale files')
    .requiredOption('--src <path>', 'Source code directory')
    .requiredOption('--locale <path>', 'Locale files directory')
    .option('-y, --yes', 'Skip confirmation prompt', false)
    .action(async (options) => {
    console.log(chalk_1.default.bold.cyan('\n🗑️  i18n Tree Shaking - Remove\n'));
    const scanResult = await (0, scan_1.scanProject)(options.src);
    const localeKeys = (0, locale_1.loadLocaleKeys)(options.locale);
    const unusedKeys = [...localeKeys].filter((key) => !scanResult.usedKeys.has(key));
    if (unusedKeys.length === 0) {
        console.log(chalk_1.default.green('✓ No unused keys to remove\n'));
        return;
    }
    // Show keys to remove by locale
    const localeReports = (0, locale_1.generateLocaleReports)(options.locale, scanResult.usedKeys);
    for (const report of localeReports) {
        if (report.unusedKeys.length > 0) {
            console.log(renderLocaleReportBox(report.fileName, report.filePath, report.totalKeys, report.usedKeys, report.unusedKeys, report.missingKeys, false));
            console.log();
        }
    }
    // Confirmation
    if (!options.yes) {
        console.log(chalk_1.default.bold(`\n⚠  This will modify ${(0, locale_1.getLocaleFiles)(options.locale).length} locale file(s)`));
        const readline = await Promise.resolve().then(() => __importStar(require('readline')));
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise((resolve) => rl.question(chalk_1.default.bold('\n❓ Proceed with removal? (y/N): '), resolve));
        rl.close();
        if (answer.toLowerCase() !== 'y') {
            console.log(chalk_1.default.gray('\n✗ Cancelled\n'));
            return;
        }
    }
    // Perform removal
    console.log(chalk_1.default.bold('\n🔄 Removing keys...\n'));
    const removed = (0, locale_1.removeKeysFromLocales)(options.locale, unusedKeys);
    // Show results
    console.log(chalk_1.default.green.bold(`✓ Successfully removed ${Object.keys(removed).length} key(s):\n`));
    // Group by file
    const byFile = {};
    for (const [key, info] of Object.entries(removed)) {
        if (!byFile[info.file])
            byFile[info.file] = [];
        byFile[info.file].push(key);
    }
    for (const [file, keys] of Object.entries(byFile)) {
        console.log(chalk_1.default.bold(`${file}:`));
        for (const key of keys.sort()) {
            console.log(chalk_1.default.gray(`  - ${key}`));
        }
    }
    console.log(chalk_1.default.green('\n✓ Done!\n'));
});
program.parse();
