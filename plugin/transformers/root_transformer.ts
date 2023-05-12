import { NodePath, Scope } from '@babel/traverse';
import * as t from '@babel/types';
import { HookNode, HookTransformer, isHookPath } from './hook_transformer.js';
import { Transformer } from './transformer.js';
import { UseRefTransformer } from './use_ref_transformer.js';
import { UseStateTransformer } from './use_state_transformer.js';

export type RootTransformerConfig = {
  moduleName: string,
  reactModuleName: string,
};

export class RootTransformer extends Transformer {
  readonly config: RootTransformerConfig;
  readonly moduleImportDeclarations = new Map<t.Identifier, NodePath<t.ImportDeclaration>>();
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
        if (!isHookPath(path)) return;
        const hook = this.createHookTransformer(path);

        if (hook) {
          hook.traverse(path);
          this.hooks.push(hook);
        }
      },
    });
  }

  createHookTransformer(path: NodePath<HookNode>) {
    if (!this.isModuleReference(path.scope, path.node.callee.object)) return;

    switch (path.node.callee.property.name) {
      case 'useState': return new UseStateTransformer();
      case 'useRef': return new UseRefTransformer();
    }
  }

  isModuleReference(scope: Scope, id: t.Identifier) {
    const bindingId = scope.getBindingIdentifier(id.name);

    return this.moduleImportDeclarations.has(bindingId);
  }
}
