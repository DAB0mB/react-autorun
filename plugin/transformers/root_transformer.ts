import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { HookTransformer } from './hook_transformer.js';
import { Transformer } from './transformer.js';
import { HookTransformerFactory } from './hook_transformer_factory.js';

export type RootTransformerConfig = {
  moduleName: string,
  reactModuleName: string,
};

export class RootTransformer extends Transformer {
  readonly config: RootTransformerConfig;
  readonly moduleImportDeclarations = new Map<t.Identifier, NodePath<t.ImportDeclaration>>();
  readonly hookTransformerFactory = new HookTransformerFactory(this);
  readonly hooks: HookTransformer[] = [];

  constructor(config: Partial<RootTransformerConfig> = {}) {
    super();

    this.config = {
      moduleName: 'react-useless',
      reactModuleName: 'react',
      ...config,
    };
  }

  transform(): void {
    for (const hook of this.hooks) {
      hook.transform();
    }

    for (const [, declaration] of this.moduleImportDeclarations) {
      declaration.replaceWith(
        t.importDeclaration(
          declaration.node.specifiers,
          t.stringLiteral(this.config.reactModuleName),
        ),
      );
    }
  }

  traverse(path: NodePath<t.Program>) {
    path.traverse({
      ImportDeclaration: (path) => {
        if (path.node.source.value !== this.config.moduleName) return;

        for (const specifier of path.node.specifiers) {
          if (t.isImportDefaultSpecifier(specifier)) {
            this.moduleImportDeclarations.set(specifier.local, path);
          }
        }
      },

      CallExpression: (path) => {
        const hook = this.hookTransformerFactory.create(path);

        if (hook) {
          hook.traverse();
          this.hooks.push(hook);
        }
      },
    });
  }
}
