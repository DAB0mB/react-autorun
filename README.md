# React Autorun

React Autorun is a powerful macro that simplifies the management of dependencies for hooks in React. It offers a seamless way to specify dependencies while providing control over their behavior. With React Autorun, you can easily ignore specific objects from being included as dependencies, eliminating the need for workarounds like wrapping values with `useRef`.

## Key Features

- **Automatic Dependency Tracking**: React Autorun eliminates the need to manually specify dependencies by automatically generating the dependencies array for your hooks at compile-time.
- **Flexible Ignoring of Values**: You can mark certain values as ignored, ensuring they are not considered as dependencies during runtime.
- **Works with Any Hook**: React Autorun decouples the dependencies' logic from the hook type, allowing you to specify dependencies for any hook, not just React's hooks.

## Before and After Compilation

Before:

```tsx
import { useEffect, useState } from 'react';
import { autorun } from 'react-autorun';
import { GameContext } from '../game/context';
import { createGame } from '../game/game';
import { GameBoard } from './game_board';

export function Blackjack() {
  const [game, setGame] = useState(createGame);

  useEffect(() => {
    const unlistenToRestart = game.restartEvent.listen(() => {
      setGame(createGame());
    });

    return () => {
      unlistenToRestart();
    };
  }, autorun);

  return (
    <GameContext.Provider value={game}>
      <GameBoard />
    </GameContext.Provider>
  );
}
```

After:

```tsx
import { useEffect, useState } from 'react';
import { autorun } from 'react-autorun';
import { GameContext } from '../game/context';
import { createGame } from '../game/game';
import { GameBoard } from './game_board';

export function Blackjack() {
  const [game, setGame] = useState(createGame);

  useEffect(() => {
    const unlistenToRestart = game.restartEvent.listen(() => {
      setGame(createGame());
    });

    return () => {
      unlistenToRestart();
    };
  }, autorun(() => [game?.restartEvent?.listen, game?.restartEvent]));

  return (
    <GameContext.Provider value={game}>
      <GameBoard />
    </GameContext.Provider>
  );
}
```

The "after" code showcases how React Autorun can transform the dependencies array for hooks, providing a more streamlined and intuitive approach.

## Ignoring Values with `autorun.ignore`

React Autorun provides a way to ignore specific values from being treated as dependencies. Some React hook values, such as `useState()`, `useReducer()`, and `useRef()`, are already ignored by the compiler out of the box.

Here's an example that demonstrates using `autorun.ignore()` to exclude a value from the dependencies:

```tsx
import { useCallback, useInsertionEffect, useRef } from 'react';
import { autorun } from 'react-autorun';

export function useCaller<Fn extends (...args: any) => any>(fn: Fn) {
  const ref = useRef(callerRefInit as Fn);

  useInsertionEffect(() => {
    ref.current = fn;
  }, autorun);

  const caller = useCallback((...args: any) => {
    return ref.current(...args);
  }, autorun) as Fn;

  // `useCaller()` return value is now ignored by hooks
  return autorun.ignore(caller);
}

function callerRefInit() {
  throw new Error('Function not ready');
}
```

With this usage of `autorun.ignore`, the caller value returned by `useCaller()` will be excluded as a dependency when used within other hooks. This ensures that the hook won't be invalidated if, for some particular reason, the caller reference has changed.

## Installation and Setup

To install React Autorun, use npm:

```
npm install react-autorun
```

Next, load the plugin using Babel or SWC.

### Babel Setup

If you use Babel, edit your `.babelrc` file to include `react-autorun/plugin/babel`:

```json
{
  "plugins": ["react-autorun/plugin/babel"]
}
```

### SWC Setup

If you use SWC with Next.js, edit your `next.config.js` file to include `react-autorun/plugin/swc`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    swcPlugins: [
      ['react-autorun/plugin/swc', {}]
    ]
  }
}

module.exports = nextConfig
```

Please note that [loading SWC plugins with Next.js is currently an experimental feature](https://nextjs.org/docs/architecture/nextjs-compiler#swc-plugins-experimental), which may lead to inconsistent results. Make sure to review the Next.js documentation for further details.

## License

React Autorun is licensed under the MIT license. See the [LICENSE](./LICENSE) file for more details.
