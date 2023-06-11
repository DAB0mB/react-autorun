import { useState, useReducer, useRef } from 'react';
import { autorun } from 'react-autorun';

{
  const [state, setState] = useState();
  const [reducedState, dispatch] = useReducer();
  const ref = useRef();

  useHook(() => {
    state;
    setState;
    reducedState;
    dispatch;
    ref;
    ref.current;
  }, autorun);
}
