const esbuild = require('esbuild');
const { resolve } = require('path');
const { performance } = require('perf_hooks');

const startTime = performance.now();

Promise.allSettled([
  esbuild.build({
    entryPoints: [resolve('babel/index.ts')],
    outfile: resolve('babel/index.js'),
    bundle: true,
    sourcemap: true,
    platform: 'node',
    packages: 'external',
    target: 'es6',
  }).then((report) => {
    console.log('Babel build', {
      duration: measureDuration(),
      report,
    });
  }),

  esbuild.build({
    entryPoints: [resolve('runtime/index.ts')],
    outfile: resolve('runtime/index.js'),
    bundle: true,
    sourcemap: true,
    platform: 'node',
    packages: 'external',
    target: 'es6',
  }).then((report) => {
    console.log('Runtime build', {
      duration: measureDuration(),
      report,
    });
  }),
]).then(results => {
  const someErrors = results.some(result => result.status === 'rejected');

  if (someErrors) {
    process.exit(1);
  }
});

function measureDuration() {
  return `${(performance.now() - startTime).toFixed(2)}s`;
}
