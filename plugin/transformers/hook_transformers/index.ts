import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Config } from '../../config.js';
import { getIdentifierSource } from '../../utils/ast.js';
import { HookTransformer, isDirectCallExpressionPath, isMemberCallExpressionPath } from '../hook_transformers/hook_transformer.js';
import { UseCallbackTransformer } from './use_callback_transformer.js';
import { UseEffectTransformer } from './use_effect_transformer.js';
import { UseInsertionEffectTransformer } from './use_insertion_effect_transformer.js';
import { UseLayoutEffectTransformer } from './use_layout_effect_transformer.js';
import { UseMemoTransformer } from './use_memo_transformer.js';
import { UseRefTransformer } from './use_ref_transformer.js';
import { UseStateTransformer } from './use_state_transformer.js';

export function createHookTransformer(path: NodePath<t.CallExpression>, config: Config): HookTransformer | undefined {
  const hook = getHook(path, config);
  if (!hook) return;

  switch (hook.type) {
    case 'useCallback': return new UseCallbackTransformer(hook.path, config);
    case 'useEffect': return new UseEffectTransformer(hook.path, config);
    case 'useInsertionEffect': return new UseInsertionEffectTransformer(hook.path, config);
    case 'useLayoutEffect': return new UseLayoutEffectTransformer(hook.path, config);
    case 'useMemo': return new UseMemoTransformer(hook.path, config);
    case 'useRef': return new UseRefTransformer(hook.path, config);
    case 'useState': return new UseStateTransformer(hook.path, config);
  }
}

function getHook(path: NodePath<t.CallExpression>, config: Config) {
  let idPath: NodePath<t.Identifier>;
  let hookType: string;

  if (isMemberCallExpressionPath(path)) {
    idPath = path.get('callee').get('object');
    hookType = path.node.callee.property.name;
  }
  else if (isDirectCallExpressionPath(path)) {
    idPath = path.get('callee');
  }
  else {
    return;
  }

  const source = getIdentifierSource(idPath);
  if (!source || source.declaration.source.value !== config.moduleName) return;

  hookType ??= source.id.name;

  return {
    path,
    type: hookType,
  };
}
