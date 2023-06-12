import * as esbuild from 'esbuild';
import { resolve } from 'path';

esbuild.build({
  entryPoints: [resolve(__dirname, '../index.ts')],
  outfile: resolve(__dirname, '../index.js'),
  bundle: true,
  sourcemap: true,
  platform: 'node',
  packages: 'external',
  target: 'es6',
}).then(
  result => console.log(result),
  error => console.error(error),
);
