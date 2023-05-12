import { Visitor } from '@babel/traverse';
import { RootTransformer } from './transformers/root_transformer.js';

export default function() {
  const root = new RootTransformer();

  return {
    visitor: {
      Program: {
        enter(path) {
          root.traverse(path);
        },

        exit() {
          root.transform();
        },
      },
    } as Visitor,
  };
}
