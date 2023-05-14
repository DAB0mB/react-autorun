import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Store } from '../../store.js';
import { HookNode, HookTransformer, zHookNode } from '../hook_transformers/hook_transformer.js';
import { UseCallbackTransformer } from '../hook_transformers/use_callback_transformer.js';
import { UseRefTransformer } from './use_ref_transformer.js';
import { UseStateTransformer } from './use_state_transformer.js';
import { UseEffectTransformer } from './use_effect_transformer.js';
import { UseInsertionEffectTransformer } from './use_insertion_effect_transformer.js';
import { UseMemoTransformer } from './use_memo_transformer.js';
import { UseLayoutEffectTransformer } from './use_layout_effect_transformer.js';

export function createHookTransformer(store: Store, path: NodePath<t.CallExpression>): HookTransformer | undefined {
  if (!isHookPath(path)) return;

  const bindingId = path.scope.getBindingIdentifier(path.node.callee.object.name);
  if (!store.moduleImportDeclarations.has(bindingId)) return;

  switch (path.node.callee.property.name) {
    case 'useCallback': return new UseCallbackTransformer(store, path);
    case 'useEffect': return new UseEffectTransformer(store, path);
    case 'useInsertionEffect': return new UseInsertionEffectTransformer(store, path);
    case 'useLayoutEffect': return new UseLayoutEffectTransformer(store, path);
    case 'useMemo': return new UseMemoTransformer(store, path);
    case 'useRef': return new UseRefTransformer(store, path);
    case 'useState': return new UseStateTransformer(store, path);
  }
}

function isHookPath(path: NodePath<t.CallExpression>): path is NodePath<HookNode> {
  return isHookNode(path.node);
}

function isHookNode(node: t.CallExpression): node is HookNode {
  return zHookNode.safeParse(node).success;
}
