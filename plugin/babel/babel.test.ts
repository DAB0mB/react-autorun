import { CodeGenerator } from '@babel/generator';
import { parse } from '@babel/parser';
import traverse, { visitors } from '@babel/traverse';
import { Node } from '@babel/types';
import { equal } from 'node:assert';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import plugin from './babel';

const testDir = resolve(__dirname, '../test');

type Config = typeof defaultConfig;

const defaultConfig = {
  autorun_symbol: 'autorun' as string,
};

test('babel plugin', async (t) => {
  const fixtures = await readdir(`${testDir}/fixture`);

  await Promise.all(fixtures.map(async fixture => {
    const fixtureDir = `${testDir}/fixture/${fixture}`;
    const input = await readFile(`${fixtureDir}/input.ts`).then(file => file.toString().trim());
    const output = await readFile(`${fixtureDir}/output.ts`).then(file => file.toString().trim());
    const config: Config = await readFile(`${fixtureDir}/config.json`)
      .then(
        file => ({ ...defaultConfig, ...JSON.parse(file.toString()) }),
        () => ({ ...defaultConfig }),
      );
    await t.test(fixture, () => {
      equal(getTransformedAutorunCode(input, config), output);
    })
  }));
});

function getTransformedAutorunCode(input: string, config: Config) {
  const ast = parse(input, {
    sourceType: 'module',
    plugins: ['optionalChaining'],
  });

  let autorunNode: Node | null = null;
  const throwAutorunNode = {
    CallExpression(path) {
      if (path.get('callee').isIdentifier(({ name: config.autorun_symbol }))) {
        throw (autorunNode = path.node);
      }
    },
  };
  const visitor = visitors.merge([plugin().visitor, throwAutorunNode]);

  try {
    traverse(ast, visitor);
  }
  catch (error) {
    if (error !== autorunNode) {
      throw error;
    }
  }

  if (autorunNode == null) {
    return 'AUTORUN_NOT_FOUND';
  }

  return new CodeGenerator(autorunNode).generate().code;
}
