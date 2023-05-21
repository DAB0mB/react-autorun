type ReactDeps = unknown[];

export const autorun = createAutorun();

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

    ignoreSet.add(proxy);

    return proxy;
  };

  return autorun as ReactDeps & typeof autorun;
}
