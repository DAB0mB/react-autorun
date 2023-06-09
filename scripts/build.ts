import * as esbuild from 'esbuild';
import { execa } from 'execa';
import { resolve } from 'path';
import { performance } from 'perf_hooks';

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

  execa('cargo', ['build-wasi', '--release'], {
    cwd: resolve('swc'),
  }).then((report) => {
    console.log('Swc build', {
      duration: measureDuration(),
      report,
    });
  }),
]).then(results => {
  const errors = results.map(result => result.status === 'rejected' && result.reason).filter(Boolean);

  if (errors.length) {
    console.error(
      new Error('Build completed with errors', {
        cause: errors,
      }),
    );

    process.exit(1);
  }
});

function measureDuration() {
  return `${(performance.now() - startTime).toFixed(2)}s`;
}
