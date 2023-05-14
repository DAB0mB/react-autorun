import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Store } from '../../store.js';
import { HookTransformer, parseHook } from '../hook_transformers/hook_transformer.js';
import { UseCallbackTransformer } from '../hook_transformers/use_callback_transformer.js';
import { UseRefTransformer } from './use_ref_transformer.js';
import { UseStateTransformer } from './use_state_transformer.js';
import { UseEffectTransformer } from './use_effect_transformer.js';
import { UseInsertionEffectTransformer } from './use_insertion_effect_transformer.js';
import { UseMemoTransformer } from './use_memo_transformer.js';
import { UseLayoutEffectTransformer } from './use_layout_effect_transformer.js';

export function createHookTransformer(store: Store, path: NodePath<t.CallExpression>): HookTransformer | undefined {
  const hook = parseHook(store, path);
  if (!hook) return;

  switch (hook.hookType) {
    case 'useCallback': return new UseCallbackTransformer(store, hook.path);
    case 'useEffect': return new UseEffectTransformer(store, hook.path);
    case 'useInsertionEffect': return new UseInsertionEffectTransformer(store, hook.path);
    case 'useLayoutEffect': return new UseLayoutEffectTransformer(store, hook.path);
    case 'useMemo': return new UseMemoTransformer(store, hook.path);
    case 'useRef': return new UseRefTransformer(store, hook.path);
    case 'useState': return new UseStateTransformer(store, hook.path);
  }
}
