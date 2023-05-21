# React Autorun

A macro that compiles into a dependencies array for hooks.

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

```tsx
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

Optionally, you can tell autorun to ignore some variables:

```ts
// utils/hooks.ts
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

Use `patchReact()` to autorun-ignore recommended React hooks:

```tsx
// index.tsx
import * as React from 'react';
import { patchReact } from 'react-autorun';
import ReactDOM from 'react-dom/client';
import App from './app';

patchReact(React);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```
