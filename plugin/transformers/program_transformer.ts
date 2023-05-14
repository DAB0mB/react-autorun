import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Store } from '../store.js';
import { createHookTransformer } from './hook_transformers/index.js';
import { Transformer } from './transformer.js';

export class ProgramTransformer extends Transformer {
  readonly moduleImportDeclarations: t.ImportDeclaration[] = [];

  constructor(store: Store, readonly path: NodePath<t.Program>) {
    super(store, path);
  }

  transform() {
    for (const hook of this.store.hooks) {
      hook.transform();
    }

    for (const importDeclaration of this.moduleImportDeclarations) {
      importDeclaration.source.value = this.store.config.reactModuleName;
    }
  }

  traverse() {
    this.path.traverse({
      ImportDeclaration: (path) => {
        if (path.node.source.value === this.store.config.moduleName) {
          this.moduleImportDeclarations.push(path.node);
        }
      },

      CallExpression: (path) => {
        const hook = createHookTransformer(this.store, path);

        if (hook) {
          hook.traverse();
          this.store.hooks.push(hook);
        }
      },
    });
  }
}
