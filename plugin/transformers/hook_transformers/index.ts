import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Config } from '../../config.js';
import { getImportedMember } from '../../utils/ast.js';
import { HookTransformer, isHookPath } from '../hook_transformers/hook_transformer.js';
import { UseCallbackTransformer } from './use_callback_transformer.js';
import { UseEffectTransformer } from './use_effect_transformer.js';
import { UseInsertionEffectTransformer } from './use_insertion_effect_transformer.js';
import { UseLayoutEffectTransformer } from './use_layout_effect_transformer.js';
import { UseMemoTransformer } from './use_memo_transformer.js';
import { UseRefTransformer } from './use_ref_transformer.js';
import { UseStateTransformer } from './use_state_transformer.js';

export function createHookTransformer(path: NodePath<t.CallExpression>, config: Config): HookTransformer | undefined {
  if (!isHookPath(path)) return;

  const callee = path.get('callee');
  const hook = getImportedMember(callee);
  if (!hook || hook.source.declaration.source.value !== config.getModuleName('react-useless')) return;

  switch (hook.source.id.name) {
    case 'useCallback': return new UseCallbackTransformer(path, config);
    case 'useEffect': return new UseEffectTransformer(path, config);
    case 'useInsertionEffect': return new UseInsertionEffectTransformer(path, config);
    case 'useLayoutEffect': return new UseLayoutEffectTransformer(path, config);
    case 'useMemo': return new UseMemoTransformer(path, config);
    case 'useRef': return new UseRefTransformer(path, config);
    case 'useState': return new UseStateTransformer(path, config);
  }
}
