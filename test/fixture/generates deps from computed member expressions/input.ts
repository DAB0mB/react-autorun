import { autorun } from 'react-autorun';

{
  let object;

  useHook(() => {
    object['member'].expression;
  }, autorun);
}
