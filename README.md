# React Autorun

A macro that compiles into a dependencies array for hooks. React Autorun also comes with a tiny runtime that lets you control the behavior of the dependencies, i.e., you can ignore objects from ever being included as dependencies. To better illustrate it, here's an example of a "before" and "after" a compilation.

Before:

```tsx
import { useEffect, useState } from 'react';
import { autorun } from 'react-autorun';
import { GameContext } from '../game/context';
import { createGame } from '../game/game';
import { GameBoard } from './game_board';

export function Blackjack() {
  const [game, setGame] = useState(creaetGame);

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
  const [game, setGame] = useState(creaetGame);

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

If you would like an object to be ignored by an autorun, you can wrap it with `autorun.ignore()`:

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

  // `useCaller()` return value is now ignored by effects
  return autorun.ignore(caller);
}

function callerRefInit() {
  throw new Error('Function not ready');
}
```

Some objects that were yielded from React hook calls will be ignored automatically during compilation time, i.e., `useState()[1]`, `useReducer()[1]`, and `useRef()`.

## Usage

Install:

```
npm install react-autorun
```

And load plugin using `.babelrc`:

```json
{
  "presets": ["next/babel"],
  "plugins": ["react-autorun/babel"]
}
```

SWC plugin is not yet available.

## LICENSE

MIT
