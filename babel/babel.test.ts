import { transform } from '@babel/core';
import traverse, { NodePath, Visitor, visitors } from '@babel/traverse';
import * as t from '@babel/types';
import { equal } from 'node:assert';
import { test } from 'node:test';
import plugin from './babel';
import { parse } from '@babel/parser';
import { CodeGenerator } from '@babel/generator';

test('babel plugin', async (t) => {
  await t.test('transforms autorun identifier into a call expression that returns an array of dependencies based on the block scope and the hook callback', () => {
    const input = `
      import { autorun } from 'react-autorun';

      const a = 1;

      {
        const b = 2;

        useHook(() => {
          const c = 3;

          a;
          b;
          c;
          d;
        }, autorun);
      }
    `;

    equal(getTransformedAutorunCode(input), 'autorun(() => [b])');
  });
});

function getTransformedAutorunCode(input: string, autorunIdName = 'autorun') {
  const ast = parse(input, { sourceType: 'module' });
  let autorunNode: t.Node | null = null;

  const visitor = visitors.merge([plugin().visitor, {
    CallExpression(path) {
      if (path.get('callee').isIdentifier(({ name: autorunIdName }))) {
        throw (autorunNode = path.node);
      }
    },
  }]);

  try {
    traverse(ast, visitor);
  }
  catch (error) {
    if (error !== autorunNode) {
      throw error;
    }
  }

  if (autorunNode == null) {
    return autorunNode;
  }

  return new CodeGenerator(ast).generate().code;
}
