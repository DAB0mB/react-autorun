import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Store } from '../../store.js';
import { HookNode, HookTransformer, zHookNode } from '../hook_transformers/hook_transformer.js';
import { UseCallbackTransformer } from '../hook_transformers/use_callback_transformer.js';
import { UseRefTransformer } from './use_ref_transformer.js';
import { UseStateTransformer } from './use_state_transformer.js';

export function createHookTransformer(store: Store, path: NodePath<t.CallExpression>): HookTransformer | undefined {
  if (!isHookPath(path)) return;

    const bindingId = path.scope.getBindingIdentifier(path.node.callee.object.name);
    if (!store.moduleImportDeclarations.has(bindingId)) return;

    switch (path.node.callee.property.name) {
      case 'useCallback': return new UseCallbackTransformer(store, path);
      case 'useState': return new UseStateTransformer(store, path);
      case 'useRef': return new UseRefTransformer(store, path);
    }
}

function isHookPath(path: NodePath<t.CallExpression>): path is NodePath<HookNode> {
  return isHookNode(path.node);
}

function isHookNode(node: t.CallExpression): node is HookNode {
  return zHookNode.safeParse(node).success;
}
