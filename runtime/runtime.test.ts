import { deepEqual } from 'node:assert';
import { test } from 'node:test';
import { autorun } from '.';

test('returns an identity array if no dependency is ignored', () => {
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

test('excludes ignored dependency object', () => {
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
