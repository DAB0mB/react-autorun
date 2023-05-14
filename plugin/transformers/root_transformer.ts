import * as t from '@babel/types';
import { Transformer } from './transformer.js';
import { createHookTransformer } from './hook_transformers/index.js';

export class RootTransformer extends Transformer {
  transform(): void {
    for (const hook of this.store.hooks) {
      hook.transform();
    }

    for (const [, declaration] of this.store.moduleImportDeclarations) {
      declaration.replaceWith(
        t.importDeclaration(
          declaration.node.specifiers,
          t.stringLiteral(this.store.config.reactModuleName),
        ),
      );
    }
  }

  traverse() {
    this.path.traverse({
      ImportDeclaration: (path) => {
        if (path.node.source.value !== this.store.config.moduleName) return;

        for (const specifier of path.node.specifiers) {
          if (t.isImportDefaultSpecifier(specifier)) {
            this.store.moduleImportDeclarations.set(specifier.local, path);
          }
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
