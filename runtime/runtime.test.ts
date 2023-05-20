import { deepEqual, equal } from 'node:assert';
import { test } from 'node:test';
import type * as ReactModule from 'react';
import { autorun, patchReact } from '.';

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

test('patchReact', async (t) => {
  await t.test('wraps recommended hooks with autorun-ignore', () => {
    const React = createReactMock();
    patchReact(React);

    const [state, setState] = React.useState('state');
    const [reducedState, dispatch] = React.useReducer(state => state, 'reducedState');
    const ref = React.useRef('ref');
    const deps = autorun(() => [
      state,
      setState,
      reducedState,
      dispatch,
      ref,
      ref.current,
    ]);

    deepEqual(deps, ['state', 'reducedState']);
  });
});

function createReactMock() {
  const React = {
    useState<T>(init: T) {
      let state = init;
      const setState = (value: T) => (state = value);

      return [state, setState];
    },
    useReducer<TArgs extends unknown[], TValue>(reducer: (state: TValue, ...args: TArgs) => TValue, init: TValue) {
      let state = init;
      const dispatch = (...args: TArgs) => state = reducer(state, ...args);

      return [state, dispatch];
    },
    useRef<T>(init: T) {
      const ref = {
        current: init,
      };

      return ref;
    },
  };

  return React as typeof ReactModule;
}
