# i18n-pruner

> 🌳 AST-based i18n key pruning tool for React projects. Prune unused translation keys from your locale files.

## Features

- **AST-based scanning** - Accurately parses TypeScript/JavaScript source code using ts-morph
- **Multiple call patterns** - Supports `t()`, `window.t()`, `useTranslate()`, `<Trans>` components
- **Per-locale reporting** - Separate report for each language file with unused/missing key detection
- **One-click removal** - Safely delete unused keys from all locale files simultaneously
- **Clickable links** - Terminal hyperlinks to jump directly to key definitions in locale files
- **Dynamic key detection** - Flags dynamic/interpolated keys that need manual review

## Installation

```bash
# Local install (recommended)
npm install i18n-pruner --save-dev

# Global install
npm install -g i18n-pruner
```

## Usage

### Scan

Scan source code and generate a pruning report:

```bash
i18n-pruner scan --src <source-dir> --locale <locale-dir>
```

**Options:**

| Option | Required | Description |
|--------|----------|-------------|
| `--src <path>` | Yes | Source code directory to scan |
| `--locale <path>` | Yes | Locale JSON files directory |
| `--show-used` | No | Show used keys in report (hidden by default) |

**Examples:**

```bash
# Basic scan
i18n-pruner scan --src ./src --locale ./src/locales

# Show all used keys
i18n-pruner scan --src ./src --locale ./src/locales --show-used
```

### Remove

Remove unused keys from all locale files:

```bash
i18n-pruner remove --src <source-dir> --locale <locale-dir>
```

**Options:**

| Option | Required | Description |
|--------|----------|-------------|
| `--src <path>` | Yes | Source code directory to scan |
| `--locale <path>` | Yes | Locale JSON files directory |
| `-y, --yes` | No | Skip confirmation prompt |

**Examples:**

```bash
# Remove with confirmation
i18n-pruner remove --src ./src --locale ./src/locales

# Remove without confirmation (for CI/CD)
i18n-pruner remove --src ./src --locale ./src/locales --yes
```

## npm scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "i18n:scan": "i18n-pruner scan --src src --locale src/locales",
    "i18n:remove": "i18n-pruner remove --src src --locale src/locales --yes",
    "i18n:check": "i18n-pruner scan --src src --locale src/locales"
  }
}
```

## Supported Patterns

| Pattern | Example |
|---------|---------|
| `t()` | `t('home.title')` |
| `window.t()` | `window.t('checkout.pay')` |
| `useTranslate()` | `const tt = useTranslate('profile'); tt('name')` |
| `<Trans>` | `<Trans i18nKey="common.welcome" />` |

## Report Output

The tool generates a report with:

- **Global Summary** - Total, used, unused, and dynamic key counts
- **Per-locale Report** (for each language file):
  - Summary statistics
  - Unused Keys (safe to remove, with clickable file links)
  - Missing Keys (used in code but not defined in this locale)
  - Used Keys (only shown with `--show-used` flag)
- **Dynamic Keys** - Keys using interpolation that need manual review

## Requirements

- Node.js >= 16
- TypeScript project with a `tsconfig.json` (auto-detected)

## License

MIT
