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

## Usage

To install React Autorun, use npm:

```
npm install react-autorun
```

Next, load the plugin in your `.babelrc` configuration file:

```json
{
  "presets": ["next/babel"],
  "plugins": ["react-autorun/babel"]
}
```

I'm currently exploring the possibility of implementing a [Next.js SWC plugin](https://nextjs.org/docs/architecture/nextjs-compiler#swc-plugins-experimental) for React Autorun as part of its ongoing development. Once the library demonstrates a strong market-fit and stability, I'll prioritize the development of the SWC plugin. Please keep in mind that React Autorun is still in the experimental phase, and your feedback and contributions are highly appreciated.

## License

React Autorun is licensed under the MIT license. See the [LICENSE](./LICENSE) file for more details.
