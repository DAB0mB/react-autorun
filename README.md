# React Autorun

## Usage

Load plugin:

```json
// .babelrc
{
  "presets": ["next/babel"],
  "plugins": ["react-autorun/babel"]
}
```

Use in React app:

```ts
// blackjack.tsx
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

It's recommended to ignore some dependencies:

```ts
// utils/hooks.ts
import { autorun } from 'react-autorun';
import { useCallback, useInsertionEffect, useRef } from 'react';

export function useCaller<Fn extends (...args: any) => any>(fn: Fn) {
  const ref = useRef(callerRefInit as Fn);

  useInsertionEffect(() => {
    ref.current = fn;
  }, [fn]);

  const caller = useCallback((...args: any) => {
    return ref.current(...args);
  }, []) as Fn;

  autorun.ignore(caller);

  return caller;
}

function callerRefInit() {
  throw new Error('Function not ready');
}
```
