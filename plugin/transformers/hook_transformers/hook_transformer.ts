import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { z } from 'zod';
import { Config } from '../../config.js';
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
  constructor(readonly path: NodePath<HookNode>, config: Config) {
    super(path, config);
  }
}

export function isMemberCallExpressionPath(path: NodePath): path is NodePath<MemberCallExpression> {
  return zMemberCallExpression.safeParse(path.node).success;
}

export function isDirectCallExpressionPath(path: NodePath): path is NodePath<DirectCallExpression> {
  return zDirectCallExpression.safeParse(path.node).success;
}
