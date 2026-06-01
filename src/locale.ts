import * as fs from 'fs'
import * as path from 'path'
import { flatten } from 'flat'

export interface KeyLocation {
  file: string
  line: number
  column: number
}

export interface LocaleReport {
  fileName: string
  filePath: string
  totalKeys: number
  usedKeys: string[]
  protectedKeys: string[]
  unusedKeys: string[]
  missingKeys: string[]  // keys used in code but not in this locale file
}

// Load keys from a single locale file
export function loadLocaleKeysFromFile(filePath: string): Set<string> {
  const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const flatJson = flatten(json) as Record<string, unknown>
  return new Set(Object.keys(flatJson))
}

// Load all keys from all locale files (union)
export function loadLocaleKeys(localePath: string): Set<string> {
  const files = fs.readdirSync(localePath)
  const keys = new Set<string>()

  for (const file of files) {
    if (!file.endsWith('.json')) continue

    const fullPath = path.join(localePath, file)
    const fileKeys = loadLocaleKeysFromFile(fullPath)
    fileKeys.forEach((k) => keys.add(k))
  }

  return keys
}

// Get all locale files
export function getLocaleFiles(localePath: string): string[] {
  const files = fs.readdirSync(localePath)
  return files.filter((f) => f.endsWith('.json')).map((f) => path.join(localePath, f))
}

// Generate report for each locale file
export function generateLocaleReports(
  localePath: string,
  usedKeys: Set<string>,
  protectedKeys: Set<string> = new Set()
): LocaleReport[] {
  const reports: LocaleReport[] = []
  const files = getLocaleFiles(localePath)

  for (const file of files) {
    const fileKeys = loadLocaleKeysFromFile(file)
    const usedInFile: string[] = []
    const protectedInFile: string[] = []
    const unusedInFile: string[] = []

    fileKeys.forEach((key) => {
      if (usedKeys.has(key)) {
        usedInFile.push(key)
      } else if (protectedKeys.has(key)) {
        protectedInFile.push(key)
      } else {
        unusedInFile.push(key)
      }
    })

    // Find keys used in code but missing in this locale file
    const missingInFile: string[] = []
    usedKeys.forEach((key) => {
      if (!fileKeys.has(key)) {
        missingInFile.push(key)
      }
    })

    reports.push({
      fileName: path.basename(file),
      filePath: file,
      totalKeys: fileKeys.size,
      usedKeys: usedInFile.sort(),
      protectedKeys: protectedInFile.sort(),
      unusedKeys: unusedInFile.sort(),
      missingKeys: missingInFile.sort()
    })
  }

  return reports
}

// Find the line and column number of a key in a JSON file
export function findKeyLocation(filePath: string, key: string): KeyLocation | null {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  // Build the key path parts
  const keyParts = key.split('.')

  // Search for the key in the JSON content
  // Strategy: look for the last part of the key in the file
  const searchKey = keyParts[keyParts.length - 1]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Match patterns like: "key": or "key" :
    const regex = new RegExp(`^\\s*"${searchKey}"\\s*:`)
    if (regex.test(line)) {
      // Verify this is the correct key by checking parent context
      if (verifyKeyContext(lines, i, keyParts)) {
        const column = line.indexOf(`"${searchKey}"`) + 1
        return {
          file: path.basename(filePath),
          line: i + 1,
          column: column
        }
      }
    }
  }

  return null
}

// Verify that the found key matches the full key path
function verifyKeyContext(lines: string[], lineIndex: number, keyParts: string[]): boolean {
  if (keyParts.length === 1) return true

  // Simple heuristic: check if we're in the right nested context
  // by looking at the indentation and structure
  let currentDepth = 0
  const targetDepth = keyParts.length - 1

  // Count opening braces from the beginning to this line
  for (let i = 0; i <= lineIndex; i++) {
    const line = lines[i]
    for (const char of line) {
      if (char === '{' || char === '[') currentDepth++
      if (char === '}' || char === ']') currentDepth--
    }
  }

  return currentDepth >= targetDepth
}

export function removeKeysFromLocales(
  localePath: string,
  keysToRemove: string[]
): Record<string, { file: string; key: string }> {
  const removed: Record<string, { file: string; key: string }> = {}
  const files = getLocaleFiles(localePath)

  for (const file of files) {
    const json = JSON.parse(fs.readFileSync(file, 'utf-8'))
    const flatJson = flatten(json) as Record<string, unknown>

    for (const key of keysToRemove) {
      if (key in flatJson) {
        // Find and remove the key from nested structure
        unflattenRemove(json, key)
        removed[key] = { file: path.basename(file), key }
      }
    }

    fs.writeFileSync(file, JSON.stringify(json, null, 2))
  }

  return removed
}

function unflattenRemove(obj: any, key: string): boolean {
  const parts = key.split('.')
  let current = obj

  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined) return false
    current = current[parts[i]]
  }

  const lastKey = parts[parts.length - 1]
  if (lastKey in current) {
    delete current[lastKey]
    // Clean up empty parent objects
    cleanupEmptyObjects(obj, parts.slice(0, -1))
    return true
  }

  return false
}

function cleanupEmptyObjects(obj: any, pathParts: string[]): void {
  let current = obj
  for (const part of pathParts) {
    if (current[part] && typeof current[part] === 'object' && Object.keys(current[part]).length === 0) {
      delete current[part]
    }
    current = current[part]
  }
}
