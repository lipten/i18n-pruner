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
- **🛡️ Project config** - Protect dynamic/runtime keys and ignore project-specific files or lines
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
| Plural key | `t('cart.item', { count })` with `cart.item_one` / `cart.item_other` | ✅ |
| Context key | `t('user.status', { context: 'male' })` with `user.status_male` | ✅ |
| Plural + context | `t('invite.guest', { context: 'female', count })` with `invite.guest_female_other` | ✅ |
| Nesting key | `t('message.nested')` where the value contains `$t(common.welcome)` | ✅ |
| Fallback keys | `t(['error.404', 'error.default'])` | ✅ |
| Dynamic key | `t(\`${dynamicVar}.title\`)` | ⚠️ Flagged |
| Variable key | `<Trans i18nKey={dynamicKey} />` | ⚠️ Flagged |

For plural and context forms, i18n-pruner uses the locale files to expand a source key to matching i18next suffix keys. For example, when code calls `t('cart.item', { count })`, locale keys like `cart.item_one` and `cart.item_other` are treated as used. Locale values that use i18next nesting, such as `$t(common.welcome)`, also mark the nested target key as used.

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

# Show reports for all locale files (default report shows en.json only)
npx i18n-pruner scan --all-locales

# Use a config file
npx i18n-pruner scan --config ./i18n-pruner.config.json
```

**Options:**

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--src <path>` | No | `src` or `.` | Source code directory to scan. Auto-detects: `src`, `app`, `lib`, current directory |
| `--locale <path>` | No | `src/locales` or `locales` | Locale JSON files directory. Auto-detects: `src/locales`, `src/i18n`, `locales`, `i18n`, `public/locales`, `messages`, `lang` |
| `--config <path>` | No | `i18n-pruner.config.json` | Optional JSON config file |
| `--show-used` | No | `false` | Show used keys in report |
| `--all-locales` | No | `false` | Show reports for every locale file. By default only `en.json` is shown, falling back to the first locale file if `en.json` does not exist |

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

# Use a config file
npx i18n-pruner remove --config ./i18n-pruner.config.json

# Show removal reports for all locale files
npx i18n-pruner remove --all-locales
```

**Options:**

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--src <path>` | No | `src` or `.` | Source code directory to scan |
| `--locale <path>` | No | `src/locales` or `locales` | Locale JSON files directory |
| `--config <path>` | No | `i18n-pruner.config.json` | Optional JSON config file |
| `-y, --yes` | No | `false` | Skip confirmation prompt |
| `--all-locales` | No | `false` | Show reports for every locale file. By default only `en.json` is shown, falling back to the first locale file if `en.json` does not exist |

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

## Configuration

i18n-pruner automatically loads `i18n-pruner.config.json` from the current working directory. You can also pass a custom path with `--config`. Command-line `--src` and `--locale` take priority over config values.

```json
{
  "src": "src",
  "locale": "src/locales",
  "protectedKeys": ["email.title", "legacy.*", "runtime.**"],
  "ignorePaths": ["**/*.stories.tsx", "src/hooks/useTranslate.ts"],
  "ignoreLines": [
    { "file": "src/components/Foo.tsx", "lines": [42] },
    { "file": "src/components/Bar.tsx", "ranges": [{ "start": 10, "end": 20 }] }
  ],
  "ignoreComments": {
    "currentLine": "i18n-pruner-ignore-line",
    "nextLine": "i18n-pruner-ignore-next-line"
  },
  "functionNames": ["t", "window.t", "$t"],
  "transComponents": ["Trans"],
  "transKeyAttributes": ["i18nKey"],
  "namespaceHooks": [{ "name": "useTranslate", "namespaceArgIndex": 0 }],
  "dynamicKeyPolicy": "warn",
  "remove": {
    "blockOnDynamicKeys": false
  }
}
```

### Protect Keys from Removal

Use `protectedKeys` for dynamic, runtime, backend-driven, or migration keys that are valid even when no static source reference exists.

```json
{
  "protectedKeys": ["email.title", "legacy.*", "runtime.**"]
}
```

- `email.title` protects one exact key.
- `legacy.*` protects one segment below `legacy`, such as `legacy.oldButton`.
- `runtime.**` protects any nested key below `runtime`.

Protected keys are excluded from unused and remove candidates, but they are reported separately from keys actually used in code.

### Ignore Files, Lines, and Comments

Use `ignorePaths` for wrappers, generated files, stories, mocks, or tests that should not be scanned:

```json
{
  "ignorePaths": ["src/hooks/useTranslate.ts", "**/*.stories.tsx"]
}
```

Use `ignoreLines` for targeted suppressions:

```json
{
  "ignoreLines": [
    { "file": "src/components/Foo.tsx", "lines": [42] },
    { "file": "src/components/Bar.tsx", "ranges": [{ "start": 10, "end": 20 }] }
  ]
}
```

Or suppress in source with comments:

```tsx
t(dynamicKey) // i18n-pruner-ignore-line

// i18n-pruner-ignore-next-line
t(dynamicKey)
```

### Customize i18n Patterns

The defaults detect `t`, `window.t`, `$t`, `<Trans i18nKey="...">`, and `useTranslate('namespace')`. Override these when a project uses different helpers:

```json
{
  "functionNames": ["t", "i18n.t", "window.t"],
  "transComponents": ["Trans", "I18nText"],
  "transKeyAttributes": ["i18nKey", "messageKey"],
  "namespaceHooks": [{ "name": "useTranslate", "namespaceArgIndex": 0 }]
}
```

### Dynamic Key Policy

Dynamic keys are reported by default. You can change this behavior:

```json
{
  "dynamicKeyPolicy": "warn",
  "remove": {
    "blockOnDynamicKeys": true
  }
}
```

- `warn` reports dynamic keys and continues.
- `ignore` hides dynamic key warnings.
- `error` exits with a non-zero status when dynamic keys are found.
- `remove.blockOnDynamicKeys` stops `remove` when dynamic keys are found, unless `dynamicKeyPolicy` is `ignore`.

## Report Explained

### Global Summary

Shows aggregated statistics across all locale files:
- **Total Keys** - All keys defined in any locale file
- **Used in Code** - Keys actually referenced in your source code
- **Protected by Config** - Locale keys matched by `protectedKeys`
- **Unused (all locales)** - Keys defined but neither used nor protected
- **Dynamic Risk** - Keys using dynamic/interpolated values

### Per-locale Report

Each language file gets its own boxed report:
- **Summary** - Counts for this specific file
- **Used Keys** - Keys used in code and present in this file (with `--show-used`)
- **Protected Keys** - Keys kept by config even when not found in source code
- **Unused Keys** - Keys present in this file but not used or protected
- **Missing Keys** - Keys used in code but missing from this file (translations not yet added)

By default, the CLI only prints the `en.json` locale report to keep output focused. Use `--all-locales` to print every locale file report.

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
