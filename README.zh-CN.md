# i18n-pruner

> 🌳 基于 AST 的 React 项目 i18n 键清理工具。从你的翻译文件中删除未使用的翻译键。

简体中文 | [English](README.md)

**i18n-pruner** 使用 AST 解析分析你的 React/TypeScript 代码库，以查找未使用、缺失和动态翻译键。它帮助你保持翻译文件与代码同步。

## 功能特性

- **🔬 基于 AST 扫描** - 使用 [ts-morph](https://github.com/dsherret/ts-morph) 精确解析 TypeScript/JavaScript 源代码
- **📦 多种模式** - 支持 `t()`、`window.t()`、`useTranslate()`、`<Trans>` 组件
- **🌍 按语言报告** - 为每个语言文件生成单独的报告，包含未使用/缺失键检测
- **🗑️ 一键删除** - 同时从所有翻译文件中安全删除未使用的键
- **🔗 可点击链接** - 终端超链接直接跳转到翻译文件中的键定义
- **⚠️ 动态检测** - 标记需要手动审查的动态/插值键
- **🛡️ 项目配置** - 保护动态/运行时键，忽略项目特定的文件或行
- **🔧 智能默认值** - 自动检测常见的源目录和翻译目录结构

## 快速开始

```bash
# 无需安装 - 使用 npx
npx i18n-pruner scan

# 或全局安装
npm install -g i18n-pruner
i18n-pruner scan
```

## 安装

### 选项 1：npx（无需安装）

```bash
npx i18n-pruner scan
npx i18n-pruner scan --show-used
```

### 选项 2：本地安装（推荐用于项目）

```bash
npm install i18n-pruner --save-dev
```

然后添加到 `package.json`：

```json
{
  "scripts": {
    "i18n:scan": "i18n-pruner scan",
    "i18n:remove": "i18n-pruner remove --yes",
    "i18n:check": "i18n-pruner scan"
  }
}
```

### 选项 3：全局安装

```bash
npm install -g i18n-pruner
i18n-pruner scan
```

## 支持的 i18n 库

i18n-pruner 适用于任何使用以下模式的 i18n 库：

| 库 | 支持的模式 | 示例 |
|---------|-------------------|---------|
| **i18next** | `t()`, `useTranslation().t`, `<Trans>` | `t('home.title')` |
| **react-i18next** | `useTranslation()`, `<Trans i18nKey>` | `<Trans i18nKey="welcome" />` |
| **vue-i18n** | `t()`, `$t()` | `$t('message.hello')` |
| **自定义** | `window.t()`, `useTranslate()` | `window.t('key')` |

## 支持的模式

| 模式 | 示例 | 检测 |
|---------|---------|----------|
| 直接调用 | `t('home.title')` | ✅ |
| Window 对象 | `window.t('checkout.pay')` | ✅ |
| 本地包装器 | `const t = (key: string) => window.t(key)` | ✅ 包装器体被忽略 |
| 自定义 Hook | `const tt = useTranslate('profile'); tt('name')` | ✅ |
| Trans 组件 | `<Trans i18nKey="common.welcome" />` | ✅ |
| Trans 表达式字面量 | `<Trans i18nKey={"common.welcome"} />` | ✅ |
| 复数键 | `t('cart.item', { count })` 配合 `cart.item_one` / `cart.item_other` | ✅ |
| 上下文键 | `t('user.status', { context: 'male' })` 配合 `user.status_male` | ✅ |
| 复数 + 上下文 | `t('invite.guest', { context: 'female', count })` 配合 `invite.guest_female_other` | ✅ |
| 嵌套键 | `t('message.nested')` 其中值包含 `$t(common.welcome)` | ✅ |
| 回退键 | `t(['error.404', 'error.default'])` | ✅ |
| 动态键 | `t(\`${dynamicVar}.title\`)` | ⚠️ 标记 |
| 变量键 | `<Trans i18nKey={dynamicKey} />` | ⚠️ 标记 |

对于复数和上下文形式，i18n-pruner 使用翻译文件将源键扩展为匹配的 i18next 后缀键。例如，当代码调用 `t('cart.item', { count })` 时，翻译键如 `cart.item_one` 和 `cart.item_other` 被视为已使用。使用 i18next 嵌套的翻译值（例如 `$t(common.welcome)`）也会将嵌套的目标键标记为已使用。

## 预期文件结构

i18n-pruner 期望你的翻译文件是带有嵌套键的 JSON 文件：

```
project/
├── src/
│   ├── components/
│   │   └── UserProfile.tsx    # 你的 React 组件
│   ├── locales/               # 翻译文件（自动检测）
│   │   ├── en.json
│   │   ├── zh.json
│   │   └── ja.json
│   └── i18n.ts                # i18n 配置
└── package.json
```

**示例翻译文件 (`en.json`)：

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

该工具会自动展平嵌套键（例如 `home.title`、`user.settings.theme`）以进行分析。

## 使用

### 扫描

扫描源代码并生成清理报告：

```bash
# 使用默认值（自动检测 src 和 locales 目录）
npx i18n-pruner scan

# 指定自定义路径
npx i18n-pruner scan --src ./app --locale ./app/i18n

# 显示已使用的键（默认隐藏）
npx i18n-pruner scan --show-used

# 显示所有翻译文件的报告（默认报告仅显示 en.json）
npx i18n-pruner scan --all-locales

# 使用配置文件
npx i18n-pruner scan --config ./i18n-pruner.config.json
```

**选项：**

| 选项 | 必填 | 默认值 | 描述 |
|--------|----------|---------|-------------|
| `--src <path>` | 否 | `src` 或 `.` | 要扫描的源代码目录。自动检测：`src`、`app`、`lib`、当前目录 |
| `--locale <path>` | 否 | `src/locales` 或 `locales` | 翻译 JSON 文件目录。自动检测：`src/locales`、`src/i18n`、`locales`、`i18n`、`public/locales`、`messages`、`lang` |
| `--config <path>` | 否 | `i18n-pruner.config.json` | 可选的 JSON 配置文件 |
| `--show-used` | 否 | `false` | 在报告中显示已使用的键 |
| `--all-locales` | 否 | `false` | 显示每个翻译文件的报告。默认仅显示 `en.json`，如果 `en.json` 不存在则回退到第一个翻译文件 |

**默认检测顺序：**

- `--src`：尝试 `src` → `app` → `lib` → 当前目录
- `--locale`：尝试 `src/locales` → `src/i18n` → `locales` → `i18n` → `public/locales` → `messages` → `lang` → `src/lang`

**示例输出：**

```
🌳 i18n Pruner

╔══════════════════════════════════════════════════════════╗
║全局摘要                                                  ║
╠══════════════════════════════════════════════════════════╣
║  总键数（所有翻译）:         42                         ║
║  代码中使用:                     38                       ║
║  未使用（所有翻译）:              4                      ║
║  动态风险:                      2                        ║
╚══════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════╗
║                          📄 en.json                          ║
╠══════════════════════════════════════════════════════════════╣
║  摘要                                                      ║
║  ────────────────────────────────────────────────────────  ║
║  总键数:       42                                          ║
║  已使用:             38                                      ║
║  未使用:            4                                        ║
║  缺失:           0                                          ║
╠══════════════════════════════════════════════════════════════╣
║  ✗ 未使用的键                                                ║
║  ────────────────────────────────────────────────────────  ║
║    legacy.oldButton              en.json:15                ║
║    legacy.deprecated             en.json:16                ║
║    abandoned.feature1            en.json:45                ║
║    abandoned.feature2            en.json:46                ║
╚══════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════╗
║                          📄 zh.json                          ║
╠══════════════════════════════════════════════════════════════╣
║  摘要                                                      ║
║  ────────────────────────────────────────────────────────  ║
║  总键数:       42                                          ║
║  已使用:             38                                      ║
║  未使用:            4                                        ║
║  缺失:           0                                          ║
╠══════════════════════════════════════════════════════════════╣
║  ✗ 未使用的键                                                ║
║  ────────────────────────────────────────────────────────  ║
║    legacy.oldButton              zh.json:15                ║
║    legacy.deprecated             zh.json:16                ║
║    abandoned.feature1            zh.json:45                ║
║    abandoned.feature2            zh.json:46                ║
╚══════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════╗
║⚠ 动态键（需要手动审查）                                 ║
╠══════════════════════════════════════════════════════════╣
║  [0] UserProfile.tsx:42      `${dynamicKey}`              ║
║  [1] Settings.tsx:18        t(keyName)                   ║
╚══════════════════════════════════════════════════════════╝
```

### 删除

从所有翻译文件中删除未使用的键：

```bash
# 使用默认值并确认
npx i18n-pruner remove

# 跳过确认（用于 CI/CD）
npx i18n-pruner remove --yes

# 指定自定义路径
npx i18n-pruner remove --src ./app --locale ./app/i18n --yes

# 使用配置文件
npx i18n-pruner remove --config ./i18n-pruner.config.json

# 显示所有翻译文件的删除报告
npx i18n-pruner remove --all-locales
```

**选项：**

| 选项 | 必填 | 默认值 | 描述 |
|--------|----------|---------|-------------|
| `--src <path>` | 否 | `src` 或 `.` | 要扫描的源代码目录 |
| `--locale <path>` | 否 | `src/locales` 或 `locales` | 翻译 JSON 文件目录 |
| `--config <path>` | 否 | `i18n-pruner.config.json` | 可选的 JSON 配置文件 |
| `-y, --yes` | 否 | `false` | 跳过确认提示 |
| `--all-locales` | 否 | `false` | 显示每个翻译文件的报告。默认仅显示 `en.json`，如果 `en.json` 不存在则回退到第一个翻译文件 |

**示例输出：**

```
🗑️  i18n Pruner - 删除

╔══════════════════════════════════════════════════════════════╗
║                          📄 en.json                          ║
╠══════════════════════════════════════════════════════════════╣
║  摘要                                                      ║
║  ────────────────────────────────────────────────────────  ║
║  总键数:       42                                          ║
║  已使用:             38                                      ║
║  未使用:            4                                        ║
║  缺失:           0                                          ║
╠══════════════════════════════════════════════════════════════╣
║  ✗ 未使用的键                                                ║
║  ────────────────────────────────────────────────────────  ║
║    legacy.oldButton              en.json:15                ║
║    legacy.deprecated             en.json:16                ║
║    abandoned.feature1            en.json:45                ║
║    abandoned.feature2            en.json:46                ║
╚══════════════════════════════════════════════════════════════╝

⚠  这将修改 2 个翻译文件

❓ 继续删除？(y/N): y

🔄 正在删除键...

✓ 成功删除 4 个键：

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

✓ 完成！
```

## 配置

i18n-pruner 会自动从当前工作目录加载 `i18n-pruner.config.json` 加载配置。你也可以通过 `--config` 传递自定义路径。命令行 `--src` 和 `--locale` 优先于配置值。

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

### 保护键不被删除

使用 `protectedKeys` 保护动态、运行时、后端驱动或迁移键，即使没有静态源引用也有效。

```json
{
  "protectedKeys": ["email.title", "legacy.*", "runtime.**"]
}
```

- `email.title` 保护一个精确的键。
- `legacy.*` 保护 `legacy` 下的一个段，例如 `legacy.oldButton`。
- `runtime.**` 保护 `runtime` 下的任何嵌套键。

受保护的键从未使用和删除候选中排除，但它们与代码中实际使用的键分开报告。

### 忽略文件、行和注释

使用 `ignorePaths` 用于不应扫描的包装器、生成文件、故事、模拟或测试：

```json
{
  "ignorePaths": ["src/hooks/useTranslate.ts", "**/*.stories.tsx"]
}
```

使用 `ignoreLines` 用于有针对性的抑制：

```json
{
  "ignoreLines": [
    { "file": "src/components/Foo.tsx", "lines": [42] },
    { "file": "src/components/Bar.tsx", "ranges": [{ "start": 10, "end": 20 }] }
  ]
}
```

或者在源代码中使用注释抑制：

```tsx
t(dynamicKey) // i18n-pruner-ignore-line

// i18n-pruner-ignore-next-line
t(dynamicKey)
```

### 自定义 i18n 模式

默认值检测 `t`、`window.t`、`$t`、`<Trans i18nKey="...">` 和 `useTranslate('namespace')`。当项目使用不同的辅助函数时覆盖这些：

```json
{
  "functionNames": ["t", "i18n.t", "window.t"],
  "transComponents": ["Trans", "I18nText"],
  "transKeyAttributes": ["i18nKey", "messageKey"],
  "namespaceHooks": [{ "name": "useTranslate", "namespaceArgIndex": 0 }]
}
```

### 动态键策略

默认会报告动态键。你可以更改此行为：

```json
{
  "dynamicKeyPolicy": "warn",
  "remove": {
    "blockOnDynamicKeys": true
  }
}
```

- `warn` 报告动态键并继续。
- `ignore` 隐藏动态键警告。
- `error` 找到动态键时以非零状态退出。
- `remove.blockOnDynamicKeys` 在找到动态键时停止 `remove`，除非 `dynamicKeyPolicy` 为 `ignore`。

## 报告说明

### 全局摘要

显示所有翻译文件的聚合统计：
- **总键数** - 任何翻译文件中定义的所有键
- **代码中使用** - 源代码中实际引用的键
- **配置保护** - 被 `protectedKeys` 匹配的翻译键
- **未使用（所有翻译）** - 定义但既未使用也未受保护的键
- **动态风险** - 使用动态/插值值的键

### 按翻译文件报告

每个语言文件都有自己的框式报告：
- **摘要** - 此特定文件的计数
- **已使用的键** - 代码中使用且存在于此文件中的键（使用 `--show-used`）
- **受保护的键** - 即使在源代码中未找到也由配置保留的键
- **未使用的键** - 存在于此文件但未使用或未受保护的键
- **缺失的键** - 代码中使用但此文件中缺失的键（尚未添加翻译）

默认情况下，CLI 仅打印 `en.json` 翻译报告以保持输出专注。使用 `--all-locales` 打印每个翻译文件报告。

### 动态键

此处标记的键使用插值或变量。它们无法自动检查，但可能需要手动审查：

```tsx
// 这些将被标记为"动态"：
const key = 'home.title'
t(`${key}`)

const dynamicKey = getKeyFromSomewhere()
<Trans i18nKey={dynamicKey} />
```

## 要求

- Node.js >= 16
- TypeScript 项目（自动检测 tsconfig.json）

## 许可证

MIT
