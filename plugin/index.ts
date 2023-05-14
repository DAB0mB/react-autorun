import { Visitor } from '@babel/traverse';
import { ProgramTransformer } from './transformers/program_transformer.js';
import { Store } from './store.js';

export default function() {
  const store = new Store({
    moduleName: 'react-useless',
    reactModuleName: 'react',
  });

  return {
    visitor: {
      Program(path) {
        const root = new ProgramTransformer(store, path);
        root.traverse();
        root.transform();
      },
    } as Visitor,
  };
}
