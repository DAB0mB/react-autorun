import { transform } from '@babel/core';
import { NodePath, Visitor } from '@babel/traverse';
import * as t from '@babel/types';
import { equal } from 'node:assert';
import { test } from 'node:test';
import plugin from './babel';

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

    const output = transform(input, {
      plugins: [plugin, pluckAutorunCallExpression()],
      code: true,
    })!.code;

    equal(output, 'autorun(() => [b]);');
  });
});

function pluckAutorunCallExpression(calleeName = 'autorun') {
  return (): { visitor: Visitor } => {
    let autorunPath: NodePath<t.CallExpression>;

    return {
      visitor: {
        Program: {
          exit(path) {
            if (!autorunPath) {
              throw new Error('Autorun CallExpression not found');
            }
            path.node.body = [t.expressionStatement(autorunPath.node)];
          },
        },

        CallExpression(path) {
          if (path.get('callee').isIdentifier(({ name: calleeName }))) {
            autorunPath = path;
          }
        },
      },
    };
  };
}
