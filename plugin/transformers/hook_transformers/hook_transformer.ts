import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { z } from 'zod';
import { Store } from '../../store.js';
import { Transformer } from '../transformer.js';

export type HookNode = MemberCallExpression | DirectCallExpression;

type MemberCallExpression = z.infer<typeof zMemberCallExpression>;

const zMemberCallExpression =
  z.any().refine(t.isCallExpression).and(z.object({
    callee: z.any().refine(t.isMemberExpression).and(z.object({
      object: z.any().refine(t.isIdentifier),
      property: z.any().refine(t.isIdentifier),
    })),
  }));

type DirectCallExpression = z.infer<typeof zDirectCallExpression>;

const zDirectCallExpression =
  z.any().refine(t.isCallExpression).and(z.object({
    callee: z.any().refine(t.isIdentifier),
  }));

export abstract class HookTransformer extends Transformer {
  constructor(store: Store, readonly path: NodePath<HookNode>) {
    super(store, path);
  }
}

export function parseHook(store: Store, path: NodePath<t.CallExpression>) {
  let id: t.Identifier;
  let hookType: string;

  if (isMemberCallExpressionPath(path)) {
    id = path.node.callee.object;
    hookType = path.node.callee.property.name;
  }
  else if (isDirectCallExpressionPath(path)) {
    id = path.node.callee;
    hookType = '';
  }
  else {
    return;
  }

  const binding = path.scope.getBinding(id.name);
  if (!binding) return;

  if (!hookType) {
    if (!t.isImportSpecifier(binding.path.node)) return;
    if (!t.isIdentifier(binding.path.node.imported)) return;
    hookType = binding.path.node.imported.name;
  }

  const importDeclarationPath = binding.path.parentPath;
  if (!importDeclarationPath) return;
  if (!t.isImportDeclaration(importDeclarationPath.node)) return;
  if (importDeclarationPath.node.source.value !== store.config.moduleName) return;

  return {
    path,
    hookType,
  };
}

function isMemberCallExpressionPath(path: NodePath): path is NodePath<MemberCallExpression> {
  return zMemberCallExpression.safeParse(path.node).success;
}

function isDirectCallExpressionPath(path: NodePath): path is NodePath<DirectCallExpression> {
  return zDirectCallExpression.safeParse(path.node).success;
}
