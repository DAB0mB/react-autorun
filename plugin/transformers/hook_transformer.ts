import { NodePath, Visitor } from '@babel/traverse';
import * as t from '@babel/types';
import { Transformer } from './transformer.js';

export type HookNode = t.CallExpression & {
  callee: t.CallExpression & {
    object: t.Identifier,
    property: t.Identifier
  }
};

export abstract class HookTransformer extends Transformer {
  abstract traverse(path: NodePath<HookNode>): void;
}

export function isHookPath(path: NodePath<t.CallExpression>): path is NodePath<HookNode> {
  return isHookNode(path.node);
}

export function isHookNode(node: t.CallExpression): node is HookNode {
  if (!t.isCallExpression(node)) return false;
  if (!t.isMemberExpression(node.callee)) return false;
  if (!t.isIdentifier(node.callee.object)) return false;
  if (!t.isIdentifier(node.callee.property)) return false;

  return true;
}
