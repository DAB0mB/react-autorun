import { NodePath } from '@babel/traverse';
import { Config } from '../config';

export abstract class Transformer {
  constructor(readonly path: NodePath, readonly config: Config) {}

  abstract transform(): void;

  abstract traverse(): void;
}
