import { CodeGenerator } from '@babel/generator';
import { parse } from '@babel/parser';
import traverse, { visitors } from '@babel/traverse';
import * as t from '@babel/types';
import { equal } from 'node:assert';
import { test } from 'node:test';
import plugin from './babel';

test('babel plugin', async (t) => {
  await t.test('transforms autorun identifier into a call expression that returns an array of dependencies based on the block scope and the hook callback', () => {
    const input = `
      import { autorun } from 'react-autorun';

      let a;

      {
        let b;

        useHook(() => {
          let c;

          a;
          b;
          c;
          d;
        }, autorun);
      }
    `;

    equal(getTransformedAutorunCode(input), 'autorun(() => [b])');
  });

  await t.test('includes a complete member expression', () => {
    const input = `
      import { autorun } from 'react-autorun';

      {
        let object;

        useHook(() => {
          object.member.expression;
        }, autorun);
      }
    `;

    equal(getTransformedAutorunCode(input), 'autorun(() => [object.member.expression])');
  });

  await t.test('includes caller if callee is a member expression', () => {
    const input = `
      import { autorun } from 'react-autorun';

      {
        let caller;

        useHook(() => {
          caller.callee();
        }, autorun);
      }
    `;

    equal(getTransformedAutorunCode(input), 'autorun(() => [caller.callee, caller])');
  });

  await t.test('transforms autorun alias', () => {
    const input = `
      import { autorun as autorunAlias } from 'react-autorun';

      let a;

      {
        let b;

        useHook(() => {
          let c;

          a;
          b;
          c;
          d;
        }, autorunAlias);
      }
    `;

    equal(getTransformedAutorunCode(input, 'autorunAlias'), 'autorunAlias(() => [b])');
  });

  await t.test('does not transform autorun if it was not imported', () => {
    const input = `
      let a;

      {
        let b;

        useHook(() => {
          let c;

          a;
          b;
          c;
          d;
        }, autorun);
      }
    `;

    equal(getTransformedAutorunCode(input), null);
  });

  await t.test('does not transform ignore calls', () => {
    const input = `
      import { autorun } from 'react-autorun';

      let a;

      {
        let b;

        autorun.ignore(b);

        useHook(() => {
          let c;

          a;
          b;
          c;
          d;
        }, autorun);
      }
    `;

    equal(getTransformedAutorunCode(input), 'autorun(() => [b])');
  });

  await t.test('handles commonjs', () => {
    const input = `
      const { autorun } = require('react-autorun');

      let a;

      {
        let b;

        useHook(() => {
          let c;

          a;
          b;
          c;
          d;
        }, autorun);
      }
    `;

    equal(getTransformedAutorunCode(input), 'autorun(() => [b])');
  });

  await t.test('handles commonjs alias', () => {
    const input = `
      const { autorun: autorunAlias } = require('react-autorun');

      let a;

      {
        let b;

        useHook(() => {
          let c;

          a;
          b;
          c;
          d;
        }, autorunAlias);
      }
    `;

    equal(getTransformedAutorunCode(input, 'autorunAlias'), 'autorunAlias(() => [b])');
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

  return new CodeGenerator(autorunNode).generate().code;
}
