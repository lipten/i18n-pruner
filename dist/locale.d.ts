export interface KeyLocation {
    file: string;
    line: number;
    column: number;
}
export interface LocaleReport {
    fileName: string;
    filePath: string;
    totalKeys: number;
    usedKeys: string[];
    unusedKeys: string[];
    missingKeys: string[];
}
export declare function loadLocaleKeysFromFile(filePath: string): Set<string>;
export declare function loadLocaleKeys(localePath: string): Set<string>;
export declare function getLocaleFiles(localePath: string): string[];
export declare function generateLocaleReports(localePath: string, usedKeys: Set<string>): LocaleReport[];
export declare function findKeyLocation(filePath: string, key: string): KeyLocation | null;
export declare function removeKeysFromLocales(localePath: string, keysToRemove: string[]): Record<string, {
    file: string;
    key: string;
}>;
