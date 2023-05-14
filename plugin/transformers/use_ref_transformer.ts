import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { HookNode, HookTransformer } from './hook_transformer.js';

export class UseRefTransformer extends HookTransformer {
  id?: t.Identifier;
  readonly references: NodePath<t.Identifier>[] = [];

  transform() {
    if (!this.id) return;

    for (const reference of this.references) {
      reference.replaceWith(
        t.identifier(`${this.id.name}.current`),
      );
    }
  }

  traverse() {
    const variable = t.isVariableDeclarator(this.path.parentPath.node) ? this.path.parentPath as NodePath<t.VariableDeclarator> : undefined;
    if (!variable) return;

    const id = this.id = t.isIdentifier(variable.node.id) ? variable.node.id : undefined;
    if (!id) return;

    this.path.scope.path.traverse({
      Identifier: (path) => {
        if (path.node === id) return;

        const bindingId = path.scope.getBindingIdentifier(path.node.name);
        if (bindingId !== id) return;

        this.references.push(path);
      },
    });
  }
}
