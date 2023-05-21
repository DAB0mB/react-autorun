# React Autorun

A macro that compiles into a dependencies array for hooks. React Autorun also comes with a tiny runtime that lets you control the behavior of the dependencies, i.e., you can ignore objects from ever being included as dependencies. To better illustrate it, here's an example of a "before" and "after" a compilation.

Before:

```tsx
import { useEffect, useState } from 'react';
import { autorun } from 'react-autorun';
import { GameContext } from '../game/context';
import { Game, createGame } from '../game/game';
import css from './blackjack.module.css';
import { GameBoard } from './game_board';

export function Blackjack() {
  const [game, setGame] = useState<Game>();

  useEffect(() => {
    if (!game) return;

    const unlistenToRestart = game.restartEvent.listen(() => {
      setGame(undefined);
    });

    return () => {
      unlistenToRestart();
    };
  }, autorun);

  useEffect(() => {
    if (game) return;

    let mounted = true;

    createGame().then((game) => {
      mounted && setGame(game);
    });

    return () => {
      mounted = false;
    };
  }, autorun);

  const render = () => {
    if (!game) return null;

    return (
      <GameContext.Provider value={game}>
        <GameBoard />
      </GameContext.Provider>
    );
  };

  return (
    <div className={css.blackjack}>
      {render()}
    </div>
  );
}
```

After:

```tsx
import { useEffect, useState } from 'react';
import { autorun } from 'react-autorun';
import { GameContext } from '../game/context';
import { Game, createGame } from '../game/game';
import css from './blackjack.module.css';
import { GameBoard } from './game_board';

export function Blackjack() {
  const [game, setGame] = useState<Game>();

  useEffect(() => {
    if (!game) return;

    const unlistenToRestart = game.restartEvent.listen(() => {
      setGame(undefined);
    });

    return () => {
      unlistenToRestart();
    };
  }, autorun(() => [game, game?.restartEvent?.listen, game?.restartEvent]));

  useEffect(() => {
    if (game) return;

    let mounted = true;

    createGame().then((game) => {
      mounted && setGame(game);
    });

    return () => {
      mounted = false;
    };
  }, autorun(() => [game]));

  const render = () => {
    if (!game) return null;

    return (
      <GameContext.Provider value={game}>
        <GameBoard />
      </GameContext.Provider>
    );
  };

  return (
    <div className={css.blackjack}>
      {render()}
    </div>
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
  }, [fn]);

  const caller = useCallback((...args: any) => {
    return ref.current(...args);
  }, []) as Fn;

  return autorun.ignore(caller);
}

function callerRefInit() {
  throw new Error('Function not ready');
}
```

Some objects that were yielded from React hooks will be ignored automatically during compilation, i.e., `useState()[1]`, `useReducer()[1]`, and `useRef()`.

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
