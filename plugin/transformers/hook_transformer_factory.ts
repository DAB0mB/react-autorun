import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { HookNode, HookTransformer, zHookNode } from './hook_transformer.js';
import { RootTransformer } from './root_transformer.js';
import { UseCallbackTransformer } from './use_callback_transformer.js';
import { UseRefTransformer } from './use_ref_transformer.js';
import { UseStateTransformer } from './use_state_transformer.js';

export type HookTransformerFactoryConfig = Pick<RootTransformer, 'moduleImportDeclarations'>;

export class HookTransformerFactory {
  constructor(readonly config: HookTransformerFactoryConfig) {
  }

  create(path: NodePath<t.CallExpression>): HookTransformer | undefined {
    if (!isHookPath(path)) return;

    const bindingId = path.scope.getBindingIdentifier(path.node.callee.object.name);
    if (!this.config.moduleImportDeclarations.has(bindingId)) return;

    switch (path.node.callee.property.name) {
      case 'useCallback': return new UseCallbackTransformer(path);
      case 'useState': return new UseStateTransformer(path);
      case 'useRef': return new UseRefTransformer(path);
    }
  }
}

function isHookPath(path: NodePath<t.CallExpression>): path is NodePath<HookNode> {
  return isHookNode(path.node);
}

function isHookNode(node: t.CallExpression): node is HookNode {
  return zHookNode.safeParse(node).success;
}
