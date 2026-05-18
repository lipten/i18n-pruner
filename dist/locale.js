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
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadLocaleKeysFromFile = loadLocaleKeysFromFile;
exports.loadLocaleKeys = loadLocaleKeys;
exports.getLocaleFiles = getLocaleFiles;
exports.generateLocaleReports = generateLocaleReports;
exports.findKeyLocation = findKeyLocation;
exports.removeKeysFromLocales = removeKeysFromLocales;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const flat_1 = require("flat");
// Load keys from a single locale file
function loadLocaleKeysFromFile(filePath) {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const flatJson = (0, flat_1.flatten)(json);
    return new Set(Object.keys(flatJson));
}
// Load all keys from all locale files (union)
function loadLocaleKeys(localePath) {
    const files = fs.readdirSync(localePath);
    const keys = new Set();
    for (const file of files) {
        if (!file.endsWith('.json'))
            continue;
        const fullPath = path.join(localePath, file);
        const fileKeys = loadLocaleKeysFromFile(fullPath);
        fileKeys.forEach((k) => keys.add(k));
    }
    return keys;
}
// Get all locale files
function getLocaleFiles(localePath) {
    const files = fs.readdirSync(localePath);
    return files.filter((f) => f.endsWith('.json')).map((f) => path.join(localePath, f));
}
// Generate report for each locale file
function generateLocaleReports(localePath, usedKeys) {
    const reports = [];
    const files = getLocaleFiles(localePath);
    for (const file of files) {
        const fileKeys = loadLocaleKeysFromFile(file);
        const usedInFile = [];
        const unusedInFile = [];
        fileKeys.forEach((key) => {
            if (usedKeys.has(key)) {
                usedInFile.push(key);
            }
            else {
                unusedInFile.push(key);
            }
        });
        // Find keys used in code but missing in this locale file
        const missingInFile = [];
        usedKeys.forEach((key) => {
            if (!fileKeys.has(key)) {
                missingInFile.push(key);
            }
        });
        reports.push({
            fileName: path.basename(file),
            filePath: file,
            totalKeys: fileKeys.size,
            usedKeys: usedInFile.sort(),
            unusedKeys: unusedInFile.sort(),
            missingKeys: missingInFile.sort()
        });
    }
    return reports;
}
// Find the line and column number of a key in a JSON file
function findKeyLocation(filePath, key) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    // Build the key path parts
    const keyParts = key.split('.');
    // Search for the key in the JSON content
    // Strategy: look for the last part of the key in the file
    const searchKey = keyParts[keyParts.length - 1];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match patterns like: "key": or "key" :
        const regex = new RegExp(`^\\s*"${searchKey}"\\s*:`);
        if (regex.test(line)) {
            // Verify this is the correct key by checking parent context
            if (verifyKeyContext(lines, i, keyParts)) {
                const column = line.indexOf(`"${searchKey}"`) + 1;
                return {
                    file: path.basename(filePath),
                    line: i + 1,
                    column: column
                };
            }
        }
    }
    return null;
}
// Verify that the found key matches the full key path
function verifyKeyContext(lines, lineIndex, keyParts) {
    if (keyParts.length === 1)
        return true;
    // Simple heuristic: check if we're in the right nested context
    // by looking at the indentation and structure
    let currentDepth = 0;
    const targetDepth = keyParts.length - 1;
    // Count opening braces from the beginning to this line
    for (let i = 0; i <= lineIndex; i++) {
        const line = lines[i];
        for (const char of line) {
            if (char === '{' || char === '[')
                currentDepth++;
            if (char === '}' || char === ']')
                currentDepth--;
        }
    }
    return currentDepth >= targetDepth;
}
function removeKeysFromLocales(localePath, keysToRemove) {
    const removed = {};
    const files = getLocaleFiles(localePath);
    for (const file of files) {
        const json = JSON.parse(fs.readFileSync(file, 'utf-8'));
        const flatJson = (0, flat_1.flatten)(json);
        for (const key of keysToRemove) {
            if (key in flatJson) {
                // Find and remove the key from nested structure
                unflattenRemove(json, key);
                removed[key] = { file: path.basename(file), key };
            }
        }
        fs.writeFileSync(file, JSON.stringify(json, null, 2));
    }
    return removed;
}
function unflattenRemove(obj, key) {
    const parts = key.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (current[parts[i]] === undefined)
            return false;
        current = current[parts[i]];
    }
    const lastKey = parts[parts.length - 1];
    if (lastKey in current) {
        delete current[lastKey];
        // Clean up empty parent objects
        cleanupEmptyObjects(obj, parts.slice(0, -1));
        return true;
    }
    return false;
}
function cleanupEmptyObjects(obj, pathParts) {
    let current = obj;
    for (const part of pathParts) {
        if (current[part] && typeof current[part] === 'object' && Object.keys(current[part]).length === 0) {
            delete current[part];
        }
        current = current[part];
    }
}
