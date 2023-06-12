import { execa } from 'execa';
import { resolve } from 'path';
import { performance } from 'perf_hooks';

const startTime = performance.now();

Promise.allSettled([
  execa('npm', ['run', 'build'], {
    cwd: resolve('runtime'),
  }).then((cp) => {
    console.log('Runtime build', {
      duration: measureDuration(),
      cp,
    });
  }),

  execa('npm', ['run', 'build'], {
    cwd: resolve('plugin/babel'),
  }).then((cp) => {
    console.log('Babel plugin build', {
      duration: measureDuration(),
      cp,
    });
  }),

  execa('npm', ['run', 'build'], {
    cwd: resolve('plugin/swc'),
  }).then((cp) => {
    console.log('Swc plugin build', {
      duration: measureDuration(),
      cp,
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
  return `${((performance.now() - startTime) / 1_000).toFixed(2)}s`;
}
