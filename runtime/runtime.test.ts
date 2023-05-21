import { deepEqual, equal } from 'node:assert';
import { test } from 'node:test';
import { autorun } from './runtime';

test('autorun', async (t) => {
  await t.test('returns an identity array if no dependency is ignored', () => {
    const numberState = 123;
    const stringState = '123';
    const booleanState = true;
    const objectState = {};
    const deps = autorun(() => [
      numberState,
      stringState,
      booleanState,
      objectState,
    ]);

    deepEqual(deps, [numberState, stringState, booleanState, objectState]);
  });

  await t.test('excludes ignored dependency object', () => {
    const numberState = 123;
    const stringState = '123';
    const booleanState = true;
    const objectState = autorun.ignore({});
    const deps = autorun(() => [
      numberState,
      stringState,
      booleanState,
      objectState,
    ]);

    deepEqual(deps, [numberState, stringState, booleanState]);
  });

  await t.test('excludes property values of ignored objects', () => {
    const numberState = 123;
    const stringState = '123';
    const booleanState = true;
    const objectState = autorun.ignore({ value: 'ignored' });
    const deps = autorun(() => [
      numberState,
      stringState,
      booleanState,
      objectState.value,
    ]);

    deepEqual(deps, [numberState, stringState, booleanState]);
  });

  await t.test('excludes property values of ignored property objects', () => {
    const numberState = 123;
    const stringState = '123';
    const booleanState = true;
    const objectState = { parent: autorun.ignore({ child: 'ignored' }) };
    const deps = autorun(() => [
      numberState,
      stringState,
      booleanState,
      objectState,
      objectState.parent,
      objectState.parent.child,
    ]);

    deepEqual(deps, [numberState, stringState, booleanState, objectState]);
  });

  await t.test('returns property values of ignored property objects outside of an autorun', () => {
    const objectState = { parent: autorun.ignore({ child: 'ignored' }) };

    equal(objectState.parent.child, 'ignored');
  });
});
