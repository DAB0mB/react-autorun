import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Config } from '../config.js';
import { HookTransformer } from './hook_transformers/hook_transformer.js';
import { createHookTransformer } from './hook_transformers/index.js';
import { Transformer } from './transformer.js';

export class ProgramTransformer extends Transformer {
  readonly moduleImportDeclarations: t.ImportDeclaration[] = [];
  readonly hooks: HookTransformer[] = [];

  constructor(readonly path: NodePath<t.Program>, config: Config) {
    super(path, config);
  }

  transform() {
    for (const hook of this.hooks) {
      hook.transform();
    }

    for (const importDeclaration of this.moduleImportDeclarations) {
      importDeclaration.source.value = this.config.getModuleName('react');
    }
  }

  traverse() {
    this.path.traverse({
      ImportDeclaration: (path) => {
        if (path.node.source.value === this.config.getModuleName('react-useless')) {
          this.moduleImportDeclarations.push(path.node);
        }
      },

      CallExpression: (path) => {
        const hook = createHookTransformer(path, this.config);

        if (hook) {
          hook.traverse();
          this.hooks.push(hook);
        }
      },
    });
  }
}
