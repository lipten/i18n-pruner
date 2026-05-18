# i18n-pruner

> 🌳 AST-based i18n key pruning tool for React projects. Prune unused translation keys from your locale files.

**i18n-pruner** analyzes your React/TypeScript codebase using AST parsing to find unused, missing, and dynamic translation keys. It helps you keep your locale files clean and in sync with your code.

## Features

- **🔬 AST-based scanning** - Accurately parses TypeScript/JavaScript source code using [ts-morph](https://github.com/dsherret/ts-morph)
- **📦 Multiple patterns** - Supports `t()`, `window.t()`, `useTranslate()`, `<Trans>` components
- **🌍 Per-locale reports** - Separate report for each language file with unused/missing key detection
- **🗑️ One-click removal** - Safely delete unused keys from all locale files simultaneously
- **🔗 Clickable links** - Terminal hyperlinks to jump directly to key definitions in locale files
- **⚠️ Dynamic detection** - Flags dynamic/interpolated keys that need manual review
- **🔧 Smart defaults** - Auto-detects common source and locale directory structures

## Quick Start

```bash
# No installation required - use npx
npx i18n-pruner scan

# Or install globally
npm install -g i18n-pruner
i18n-pruner scan
```

## Installation

### Option 1: npx (no install)

```bash
npx i18n-pruner scan
npx i18n-pruner scan --show-used
```

### Option 2: Local install (recommended for projects)

```bash
npm install i18n-pruner --save-dev
```

Then add to `package.json`:

```json
{
  "scripts": {
    "i18n:scan": "i18n-pruner scan",
    "i18n:remove": "i18n-pruner remove --yes",
    "i18n:check": "i18n-pruner scan"
  }
}
```

### Option 3: Global install

```bash
npm install -g i18n-pruner
i18n-pruner scan
```

## Supported i18n Libraries

i18n-pruner works with any i18n library that uses the following patterns:

| Library | Supported Patterns | Example |
|---------|-------------------|---------|
| **i18next** | `t()`, `useTranslation().t`, `<Trans>` | `t('home.title')` |
| **react-i18next** | `useTranslation()`, `<Trans i18nKey>` | `<Trans i18nKey="welcome" />` |
| **vue-i18n** | `t()`, `$t()` | `$t('message.hello')` |
| **Custom** | `window.t()`, `useTranslate()` | `window.t('key')` |

## Supported Patterns

| Pattern | Example | Detected |
|---------|---------|----------|
| Direct call | `t('home.title')` | ✅ |
| Window object | `window.t('checkout.pay')` | ✅ |
| Custom hook | `const tt = useTranslate('profile'); tt('name')` | ✅ |
| Trans component | `<Trans i18nKey="common.welcome" />` | ✅ |
| Dynamic key | `t(\`${dynamicVar}.title\`)` | ⚠️ Flagged |
| Variable key | `<Trans i18nKey={dynamicKey} />` | ⚠️ Flagged |

## Expected File Structure

i18n-pruner expects your locale files to be JSON files with nested keys:

```
project/
├── src/
│   ├── components/
│   │   └── UserProfile.tsx    # Your React components
│   ├── locales/               # Locale files (auto-detected)
│   │   ├── en.json
│   │   ├── zh.json
│   │   └── ja.json
│   └── i18n.ts                # i18n configuration
└── package.json
```

**Example locale file (`en.json`):**

```json
{
  "home": {
    "title": "Welcome",
    "subtitle": "This is the home page"
  },
  "user": {
    "profile": "User Profile",
    "settings": {
      "theme": "Theme",
      "language": "Language"
    }
  }
}
```

The tool automatically flattens nested keys (e.g., `home.title`, `user.settings.theme`) for analysis.

## Usage

### Scan

Scan source code and generate a pruning report:

```bash
# Use defaults (auto-detect src and locales directories)
npx i18n-pruner scan

# Specify custom paths
npx i18n-pruner scan --src ./app --locale ./app/i18n

# Show used keys (hidden by default)
npx i18n-pruner scan --show-used
```

**Options:**

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--src <path>` | No | `src` or `.` | Source code directory to scan. Auto-detects: `src`, `app`, `lib`, current directory |
| `--locale <path>` | No | `src/locales` or `locales` | Locale JSON files directory. Auto-detects: `src/locales`, `src/i18n`, `locales`, `i18n`, `public/locales`, `messages`, `lang` |
| `--show-used` | No | `false` | Show used keys in report |

**Default Detection Order:**

- `--src`: Tries `src` → `app` → `lib` → current directory
- `--locale`: Tries `src/locales` → `src/i18n` → `locales` → `i18n` → `public/locales` → `messages` → `lang` → `src/lang`

**Example output:**

```
🌳 i18n Pruner

╔══════════════════════════════════════════════════════════╗
║GLOBAL SUMMARY                                            ║
╠══════════════════════════════════════════════════════════╣
║  Total Keys (all locales):         42                   ║
║  Used in Code:                     38                   ║
║  Unused (all locales):              4                   ║
║  Dynamic Risk:                      2                   ║
╚══════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════╗
║                          📄 en.json                          ║
╠══════════════════════════════════════════════════════════════╣
║  Summary                                                    ║
║  ────────────────────────────────────────────────────────  ║
║  Total Keys:       42                                       ║
║  Used:             38                                       ║
║  Unused:            4                                       ║
║  Missing:           0                                       ║
╠══════════════════════════════════════════════════════════════╣
║  ✗ Unused Keys                                              ║
║  ────────────────────────────────────────────────────────  ║
║    legacy.oldButton              en.json:15                ║
║    legacy.deprecated             en.json:16                ║
║    abandoned.feature1            en.json:45                ║
║    abandoned.feature2            en.json:46                ║
╚══════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════╗
║                          📄 zh.json                          ║
╠══════════════════════════════════════════════════════════════╣
║  Summary                                                    ║
║  ────────────────────────────────────────────────────────  ║
║  Total Keys:       42                                       ║
║  Used:             38                                       ║
║  Unused:            4                                       ║
║  Missing:           0                                       ║
╠══════════════════════════════════════════════════════════════╣
║  ✗ Unused Keys                                              ║
║  ────────────────────────────────────────────────────────  ║
║    legacy.oldButton              zh.json:15                ║
║    legacy.deprecated             zh.json:16                ║
║    abandoned.feature1            zh.json:45                ║
║    abandoned.feature2            zh.json:46                ║
╚══════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════╗
║⚠ Dynamic Keys (manual review required)                   ║
╠══════════════════════════════════════════════════════════╣
║  [0] UserProfile.tsx:42      `${dynamicKey}`              ║
║  [1] Settings.tsx:18        t(keyName)                   ║
╚══════════════════════════════════════════════════════════╝
```

### Remove

Remove unused keys from all locale files:

```bash
# Use defaults with confirmation
npx i18n-pruner remove

# Skip confirmation (for CI/CD)
npx i18n-pruner remove --yes

# Specify custom paths
npx i18n-pruner remove --src ./app --locale ./app/i18n --yes
```

**Options:**

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--src <path>` | No | `src` or `.` | Source code directory to scan |
| `--locale <path>` | No | `src/locales` or `locales` | Locale JSON files directory |
| `-y, --yes` | No | `false` | Skip confirmation prompt |

**Example output:**

```
🗑️  i18n Pruner - Remove

╔══════════════════════════════════════════════════════════════╗
║                          📄 en.json                          ║
╠══════════════════════════════════════════════════════════════╣
║  Summary                                                    ║
║  ────────────────────────────────────────────────────────  ║
║  Total Keys:       42                                       ║
║  Used:             38                                       ║
║  Unused:            4                                       ║
║  Missing:           0                                       ║
╠══════════════════════════════════════════════════════════════╣
║  ✗ Unused Keys                                              ║
║  ────────────────────────────────────────────────────────  ║
║    legacy.oldButton              en.json:15                ║
║    legacy.deprecated             en.json:16                ║
║    abandoned.feature1            en.json:45                ║
║    abandoned.feature2            en.json:46                ║
╚══════════════════════════════════════════════════════════════╝

⚠  This will modify 2 locale file(s)

❓ Proceed with removal? (y/N): y

🔄 Removing keys...

✓ Successfully removed 4 key(s):

en.json:
  - abandoned.feature1
  - abandoned.feature2
  - legacy.deprecated
  - legacy.oldButton
zh.json:
  - abandoned.feature1
  - abandoned.feature2
  - legacy.deprecated
  - legacy.oldButton

✓ Done!
```

## Report Explained

### Global Summary

Shows aggregated statistics across all locale files:
- **Total Keys** - All keys defined in any locale file
- **Used in Code** - Keys actually referenced in your source code
- **Unused (all locales)** - Keys defined but never used
- **Dynamic Risk** - Keys using dynamic/interpolated values

### Per-locale Report

Each language file gets its own boxed report:
- **Summary** - Counts for this specific file
- **Used Keys** - Keys used in code and present in this file (with `--show-used`)
- **Unused Keys** - Keys present in this file but not used in code (safe to remove)
- **Missing Keys** - Keys used in code but missing from this file (translations not yet added)

### Dynamic Keys

Keys flagged here use interpolation or variables. They cannot be automatically checked but may need manual review:

```tsx
// These will be flagged as "dynamic":
const key = 'home.title'
t(`${key}`)

const dynamicKey = getKeyFromSomewhere()
<Trans i18nKey={dynamicKey} />
```

## Requirements

- Node.js >= 16
- TypeScript project (tsconfig.json is auto-detected)

## License

MIT
