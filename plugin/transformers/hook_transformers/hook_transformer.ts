import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { z } from 'zod';
import { Store } from '../../store.js';
import { Transformer } from '../transformer.js';

export type HookNode = z.infer<typeof zHookNode>;

export const zHookNode = z.any().refine(t.isCallExpression).and(z.object({
  callee: z.any().refine(t.isMemberExpression).and(z.object({
    object: z.any().refine(t.isIdentifier),
    property: z.any().refine(t.isIdentifier),
  })),
}));

export abstract class HookTransformer extends Transformer {
  constructor(store: Store, readonly path: NodePath<HookNode>) {
    super(store, path);
  }
}
