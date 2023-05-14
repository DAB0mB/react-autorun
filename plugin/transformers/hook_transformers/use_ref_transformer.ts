import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { HookTransformer } from './hook_transformer.js';

export class UseRefTransformer extends HookTransformer {
  readonly variable = t.isVariableDeclarator(this.path.parentPath.node) ? this.path.parentPath as NodePath<t.VariableDeclarator> : undefined;
  readonly id = this.variable && t.isIdentifier(this.variable.node.id) ? this.variable.node.id : undefined;
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
    if (!this.id) return

    this.path.scope.path.traverse({
      Identifier: (path) => {
        if (path.node === this.id) return;

        const bindingId = path.scope.getBindingIdentifier(path.node.name);
        if (bindingId !== this.id) return;

        this.references.push(path);
      },
    });
  }
}
