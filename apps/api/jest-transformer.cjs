// Jest transformer: ts-jest untuk kode repo + paksa CJS untuk JS ESM di node_modules.
// @nestjs/* v12 hanya ESM ("type": "module") dan jest mengabaikan node_modules
// secara default — gabungan keduanya membuat require() gagal. File iniementara
// sampai toolchain mendukung ESM penuh atau suite dipecah per kebutuhan.
const tsJest = require('ts-jest');
const ts = require('typescript');

const createTransformer = tsJest.createTransformer ?? tsJest.default.createTransformer;
const inner = createTransformer({ tsconfig: 'tsconfig.json' });

const CJS_OPTS = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
  esModuleInterop: true,
  allowJs: true,
};

module.exports = {
  ...inner,
  getCacheKey(...args) {
    return inner.getCacheKey(...args) + ':force-cjs-v2';
  },
  process(src, path, ...rest) {
    if (path.includes('node_modules') && path.endsWith('.js')) {
      // import.meta tak ada di CJS; jest menyediakan __filename/__dirname.
      // createRequire() menerima path biasa, fileURLToPath(url-file-ini) === __filename.
      const cjsSrc = src
        .replace(/import\.meta\.url/g, '__filename')
        .replace(/import\.meta\.dirname/g, '__dirname');
      const out = ts.transpileModule(cjsSrc, { compilerOptions: CJS_OPTS, fileName: path }).outputText;
      return { code: out };
    }
    return inner.process(src, path, ...rest);
  },
};
