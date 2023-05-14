import { NodePath } from '@babel/traverse';
import { Store } from '../store';

export abstract class Transformer {
  constructor(readonly store: Store, readonly path: NodePath) {}

  abstract transform(): void;

  abstract traverse(): void;
}
