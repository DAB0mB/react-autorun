import { autorun } from 'react-autorun';

{
  let caller;

  useHook(() => {
    caller.callee();
  }, autorun);
}
