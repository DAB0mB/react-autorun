import { NodePath, Visitor } from '@babel/traverse';
import * as t from '@babel/types';

export default function(): { visitor: Visitor } {
  return {
    visitor: Root.createVisitor(),
  };
}

namespace Root {
  export const createVisitor = (): Visitor => {
    const moduleTransformer = new Module.Transformer()
    const hookTransformer = new Hook.Transformer()

    return {
      Program: {
        exit() {
          hookTransformer.transform();
          moduleTransformer.transform();
        },
      },
      ImportDeclaration(path) {
        moduleTransformer.collectReactAutoImportDeclaration(path);
      },

      VariableDeclarator(path) {
        hookTransformer.collectHook(path, (...args) => moduleTransformer.isReactAutoReference(...args));
      },

      AssignmentExpression(path) {
        hookTransformer.collectHooksAssignmentExpression(path);
      },
    };
  };
}

namespace Module {
  export const REACT_MODULE = 'react';
  export const REACT_AUTO_MODULE = 'react-auto';

  export class Transformer {
    readonly importDeclarations = new Map<t.Identifier, NodePath<t.ImportDeclaration>>();

    collectReactAutoImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      if (path.node.source.value !== REACT_AUTO_MODULE) return;

      for (const specifier of path.node.specifiers) {
        if (!t.isImportDefaultSpecifier(specifier)) break;

        this.importDeclarations.set(specifier.local, path);
      }
    }

    transform() {
      this.transformImportDeclarations();
    }

    transformImportDeclarations() {
      for (const [, declaration] of this.importDeclarations) {
        declaration.replaceWith(
          t.importDeclaration(
            declaration.node.specifiers,
            t.stringLiteral(REACT_MODULE),
          ),
        );
      }
    }

    isReactAutoReference(path: NodePath, id: t.Identifier) {
      const bindingId = path.scope.getBindingIdentifier(id.name);

      return this.importDeclarations.has(bindingId);
    }
  }
}

namespace Hook {
  export type VariableDeclarator = t.VariableDeclarator & {
    id: t.Identifier,
    init: t.CallExpression & {
      callee: t.CallExpression & {
        object: t.Identifier,
        property: t.Identifier
      }
    }
  };

  export class Transformer {
    readonly hooks = new Map<t.Identifier, HookTransformer>();

    collectHook(
      path: NodePath<t.VariableDeclarator>,
      isReactAutoReference: Module.Transformer['isReactAutoReference'],
    ) {
      if (!t.isIdentifier(path.node.id)) return;
      if (!t.isCallExpression(path.node.init)) return;
      if (!t.isMemberExpression(path.node.init.callee)) return;
      if (!t.isIdentifier(path.node.init.callee.object)) return;
      if (!t.isIdentifier(path.node.init.callee.property)) return;
      if (!isReactAutoReference(path, path.node.init.callee.object)) return;

      const hookTransformer = createHookTransformer(path as NodePath<VariableDeclarator>);
      if (!hookTransformer) return;

      this.hooks.set(path.node.id, hookTransformer);
    }

    collectHooksAssignmentExpression(path: NodePath<t.AssignmentExpression>) {
      if (!t.isIdentifier(path.node.left)) return;

      const binding = path.scope.getBinding(path.node.left.name);
      if (!binding) return;

      const variableDeclarator = this.hooks.get(binding.identifier);
      if (!variableDeclarator) return;

      variableDeclarator.assignmentExpressions.push(path);
    }

    transform() {
      for (const [, hook] of this.hooks) {
        hook.transform();
      }
    }
  }

  export abstract class HookTransformer {
    abstract type: string;
    readonly id = this.variableDeclarator.node.id;
    readonly assignmentExpressions: NodePath<t.AssignmentExpression>[] = [];

    constructor(readonly variableDeclarator: NodePath<VariableDeclarator>) {
    }

    transform() {
      this.transformAssignmentExpressions();
      this.transformVariableDeclarator();
    }

    abstract transformVariableDeclarator(): void;
    abstract transformAssignmentExpressions(): void;
  }

  export class UseStateTransformer extends HookTransformer {
    readonly setterId = this.variableDeclarator.scope.generateUidIdentifier(`set${this.id.name.charAt(0).toUpperCase()}${this.id.name.slice(1)}`);

    get type() {
      return 'useState';
    }

    transformVariableDeclarator() {
      this.variableDeclarator.replaceWith(
        t.variableDeclarator(
          t.arrayPattern(
            [
              this.variableDeclarator.node.id,
              this.setterId,
            ]
          ),
          this.variableDeclarator.node.init,
        )
      );
    }

    transformAssignmentExpressions() {
      for (const expression of this.assignmentExpressions) {
        expression.replaceWith(
          t.callExpression(
            this.setterId,
            [
              expression.node.right,
            ],
          ),
        );
      }
    }
  }

  export class UseRefTransformer extends HookTransformer {
    readonly setterId = this.variableDeclarator.scope.generateUidIdentifier(`set${this.id.name.charAt(0).toUpperCase()}${this.id.name.slice(1)}`);

    get type() {
      return 'useRef';
    }

    transformVariableDeclarator() {
    }

    transformAssignmentExpressions() {
      for (const expression of this.assignmentExpressions) {
        expression.replaceWith(
          t.assignmentExpression(
            expression.node.operator,
            t.memberExpression(
              this.id,
              t.identifier('current'),
            ),
            expression.node.right,
          ),
        );
      }
    }
  }

  export function createHookTransformer(variableDeclarator: NodePath<VariableDeclarator>) {
    switch (variableDeclarator.node.init.callee.property.name) {
      case 'useState': return new UseStateTransformer(variableDeclarator);
      case 'useRef': return new UseRefTransformer(variableDeclarator);
    }
  }
}
