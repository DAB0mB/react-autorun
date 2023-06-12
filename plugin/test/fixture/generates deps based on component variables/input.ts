import { autorun } from 'react-autorun';

let a;

{
  let b;

  useHook(() => {
    let c;

    a;
    b;
    c;
    d;
  }, autorun);
}
