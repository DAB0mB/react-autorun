import { NodePath } from '@babel/traverse';

export abstract class Transformer {
  abstract transform(): void;

  abstract traverse(path: NodePath): void;
}
