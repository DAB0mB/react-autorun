import * as babel from '@babel/core';
import * as fs from 'fs';
import * as plugin from '../babel';
import * as path from 'path';

const transformDir = path.resolve(__dirname, '../transform');
const code = fs.readFileSync(`${transformDir}/in.tsx`).toString();

const transformation = babel.transform(code, {
  plugins: [
    ["@babel/plugin-transform-typescript", { isTSX: true }],
    plugin,
  ],
  code: true,
  ast: false,
});

if (transformation?.code) {
  fs.writeFileSync(`${transformDir}/out.js`, transformation.code);
}
