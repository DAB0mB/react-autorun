import { Visitor } from '@babel/traverse';
import { Config } from './config.js';
import { ProgramTransformer } from './transformers/program_transformer.js';

export default function() {
  const config: Config = {
    moduleName: 'react-useless',
    reactModuleName: 'react',
  };

  return {
    visitor: {
      Program(path) {
        const root = new ProgramTransformer(path, config);
        root.traverse();
        root.transform();
      },
    } as Visitor,
  };
}
