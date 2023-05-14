import { Visitor } from '@babel/traverse';
import { RootTransformer } from './transformers/root_transformer.js';
import { Store } from './store.js';

export default function() {
  const store = new Store({
    moduleName: 'react-useless',
    reactModuleName: 'react',
  });

  return {
    visitor: {
      Program: {
        enter(path) {
          const root = new RootTransformer(store, path);
          root.traverse();
          root.transform();
        },
      },
    } as Visitor,
  };
}
