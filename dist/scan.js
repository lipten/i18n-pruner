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
exports.scanProject = scanProject;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const fast_glob_1 = __importDefault(require("fast-glob"));
const ts_morph_1 = require("ts-morph");
function findTsConfig(srcPath) {
    // Check if tsconfig.json exists in the source directory
    const srcTsConfig = path.join(srcPath, 'tsconfig.json');
    if (fs.existsSync(srcTsConfig)) {
        return srcTsConfig;
    }
    // Check parent directory
    const parentDir = path.dirname(srcPath);
    if (parentDir !== srcPath) {
        const parentTsConfig = path.join(parentDir, 'tsconfig.json');
        if (fs.existsSync(parentTsConfig)) {
            return parentTsConfig;
        }
    }
    // Check current working directory
    const cwdTsConfig = path.resolve('tsconfig.json');
    if (fs.existsSync(cwdTsConfig)) {
        return cwdTsConfig;
    }
    return undefined;
}
async function scanProject(src) {
    const srcPath = path.resolve(src);
    const tsConfigPath = findTsConfig(srcPath);
    const projectOptions = {};
    if (tsConfigPath) {
        projectOptions.tsConfigFilePath = tsConfigPath;
    }
    else {
        // Fallback: create project without tsconfig
        projectOptions.compilerOptions = {
            target: 'ES2020',
            module: 'ESNext',
            jsx: 'react-jsx',
            esModuleInterop: true,
            skipLibCheck: true,
        };
    }
    const project = new ts_morph_1.Project(projectOptions);
    const files = await (0, fast_glob_1.default)([`${srcPath}/**/*.{ts,tsx,js,jsx}`]);
    files.forEach((file) => {
        project.addSourceFileAtPath(file);
    });
    const usedKeys = new Set();
    const dynamicKeys = [];
    for (const sourceFile of project.getSourceFiles()) {
        const translateMap = new Map();
        sourceFile.forEachDescendant((node) => {
            // ========================
            // useTranslate('home')
            // const tt = useTranslate('home')
            // ========================
            if (ts_morph_1.Node.isVariableDeclaration(node)) {
                const initializer = node.getInitializer();
                if (initializer && ts_morph_1.Node.isCallExpression(initializer)) {
                    const fnName = initializer.getExpression().getText();
                    if (fnName === 'useTranslate') {
                        const varName = node.getName();
                        const arg = initializer.getArguments()[0];
                        if (arg && ts_morph_1.Node.isStringLiteral(arg)) {
                            translateMap.set(varName, arg.getLiteralText());
                        }
                    }
                }
            }
            // ========================
            // t('aaa')
            // window.t('aaa')
            // tt('bbb')
            // ========================
            if (ts_morph_1.Node.isCallExpression(node)) {
                const expr = node.getExpression();
                const fnName = expr.getText();
                const args = node.getArguments();
                const firstArg = args[0];
                if (!firstArg)
                    return;
                const isTFunction = fnName === 't' || fnName === 'window.t' || translateMap.has(fnName);
                if (!isTFunction)
                    return;
                if (!ts_morph_1.Node.isStringLiteral(firstArg)) {
                    dynamicKeys.push({
                        file: sourceFile.getFilePath(),
                        line: firstArg.getStartLineNumber(),
                        code: firstArg.getText(),
                    });
                    return;
                }
                let key = firstArg.getLiteralText();
                if (translateMap.has(fnName)) {
                    key = `${translateMap.get(fnName)}.${key}`;
                }
                usedKeys.add(key);
            }
            // ========================
            // <Trans i18nKey="aaa" />
            // ========================
            if (ts_morph_1.Node.isJsxSelfClosingElement(node) || ts_morph_1.Node.isJsxOpeningElement(node)) {
                const tagName = node.getTagNameNode().getText();
                if (tagName !== 'Trans')
                    return;
                const attrs = node.getAttributes();
                for (const attr of attrs) {
                    if (!ts_morph_1.Node.isJsxAttribute(attr))
                        continue;
                    const jsxAttr = attr;
                    const attrNameNode = jsxAttr.getNameNode();
                    const attrName = attrNameNode.getText();
                    if (attrName !== 'i18nKey')
                        continue;
                    const initializer = jsxAttr.getInitializer();
                    if (!initializer)
                        continue;
                    if (ts_morph_1.Node.isStringLiteral(initializer)) {
                        usedKeys.add(initializer.getLiteralText());
                    }
                    else {
                        dynamicKeys.push({
                            file: sourceFile.getFilePath(),
                            line: initializer.getStartLineNumber(),
                            code: initializer.getText(),
                        });
                    }
                }
            }
        });
    }
    return { usedKeys, dynamicKeys };
}
