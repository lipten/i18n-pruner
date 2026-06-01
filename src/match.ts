import * as path from 'path'

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.*]/g, '\\$&')
}

export function normalizeSlashes(value: string): string {
  return value.split(path.sep).join('/').replace(/\\/g, '/')
}

export function matchesKeyPattern(key: string, pattern: string): boolean {
  if (!pattern.includes('*')) {
    return key === pattern
  }

  const source = pattern
    .split('.')
    .map((part) => {
      if (part === '**') return '.*'
      return escapeRegex(part).replace(/\\\*/g, '[^.]*')
    })
    .join('\\.')

  return new RegExp(`^${source}$`).test(key)
}

export function resolveProtectedKeys(
  localeKeys: Set<string>,
  protectedPatterns: string[]
): Set<string> {
  const protectedKeys = new Set<string>()

  for (const key of localeKeys) {
    if (protectedPatterns.some((pattern) => matchesKeyPattern(key, pattern))) {
      protectedKeys.add(key)
    }
  }

  return protectedKeys
}

function pathPatternToRegExp(pattern: string): RegExp {
  const normalized = normalizeSlashes(pattern)
  const source = escapeRegex(normalized)
    .replace(/\\\*\\\*/g, '.*')
    .replace(/\\\*/g, '[^/]*')

  return new RegExp(`^${source}$`)
}

export function matchesPathPattern(filePath: string, pattern: string, cwd = process.cwd()): boolean {
  const normalizedPattern = normalizeSlashes(pattern)
  const absolutePath = normalizeSlashes(path.resolve(filePath))
  const relativePath = normalizeSlashes(path.relative(cwd, filePath))
  const candidates = [absolutePath, relativePath, normalizeSlashes(filePath)]

  if (path.isAbsolute(pattern)) {
    return pathPatternToRegExp(normalizedPattern).test(absolutePath)
  }

  const regex = pathPatternToRegExp(normalizedPattern)
  return candidates.some((candidate) => regex.test(candidate))
}

export function matchesAnyPathPattern(
  filePath: string,
  patterns: string[],
  cwd = process.cwd()
): boolean {
  return patterns.some((pattern) => matchesPathPattern(filePath, pattern, cwd))
}
