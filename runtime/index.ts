import * as React from 'react';

type ReactDeps = unknown[];

export const autorun = createAutorun();

patchReact();

function createAutorun() {
  const ignoreValue = {};
  const ignoreSet = new WeakSet([ignoreValue]);
  let autorunning = false;

  function autorun(deps: () => ReactDeps) {
    autorunning = true;

    try {
      return deps().filter(value => !(value instanceof Object) || !ignoreSet.has(value));
    }
    finally {
      autorunning = false;
    }
  }

  autorun.ignore = <T extends {}>(object: T) => {
    const proxy: T = new Proxy(object, {
      get(target, property) {
        const value = (target as any)[property];

        return value instanceof Object ? autorun.ignore(value) : autorunning ? ignoreValue : value;
      },
    });

    ignoreSet.add(object);

    return proxy;
  };

  return autorun as ReactDeps & typeof autorun;
}

// Source: https://github.com/facebook/react/blob/5309f102854475030fb91ab732141411b49c1126/packages/eslint-plugin-react-hooks/src/ExhaustiveDeps.js#L151
function patchReact() {
  const { useState, useReducer, useRef } = React;

  Object.assign(React, {
    useState(...args: any) {
      const [state, setState] = useState.apply(React, args);

      return [state, autorun.ignore(setState)];
    },
    useReducer(...args: any) {
      const [state, dispatch] = useReducer.apply(React, args);

      return [state, autorun.ignore(dispatch)];
    },
    useRef(...args: any) {
      const ref = useRef.apply(React, args);

      return autorun.ignore(ref);
    },
  });
}
