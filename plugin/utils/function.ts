export function weakMemo<TArgs extends any[], TResult extends unknown>(callback: (...args: TArgs) => TResult, getKey: (...args: TArgs) => object = (...args) => args[0]) {
  const cache = new WeakMap<object, TResult>();

  return (...args: TArgs) => {
    const key = getKey(...args);
    if (cache.has(key)) {
      return cache.get(key) as TResult;
    }

    const result = callback(...args);
    cache.set(key, result);

    return result;
  };
}
