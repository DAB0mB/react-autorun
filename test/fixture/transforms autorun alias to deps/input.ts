import { autorun as autorunAlias } from 'react-autorun';

let a;

{
  let b;

  useHook(() => {
    let c;

    a;
    b;
    c;
    d;
  }, autorunAlias);
}
