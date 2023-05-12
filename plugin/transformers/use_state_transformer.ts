import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { HookNode, HookTransformer } from './hook_transformer.js';

export class UseStateTransformer extends HookTransformer {
  setterId?: t.Identifier;
  variable?: NodePath<t.VariableDeclarator>;
  readonly assignments: NodePath<t.AssignmentExpression>[] = [];

  transform() {
    if (!this.variable) return;
    if (!this.setterId) return;

    this.variable.replaceWith(
      t.variableDeclarator(
        t.arrayPattern(
          [
            this.variable.node.id,
            this.setterId,
          ]
        ),
        this.variable.node.init,
      )
    );

    for (const assignment of this.assignments) {
      assignment.replaceWith(
        t.callExpression(
          this.setterId,
          [
            assignment.node,
          ],
        ),
      );
    }
  }

  traverse(path: NodePath<HookNode>) {
    this.variable = t.isVariableDeclarator(path.parentPath.node) ? path.parentPath as NodePath<t.VariableDeclarator> : undefined;
    if (!this.variable) return;

    const id = t.isIdentifier(this.variable.node.id) ? this.variable.node.id : undefined;
    if (!id) return;

    this.setterId = path.scope.generateUidIdentifier(`set${id.name.charAt(0).toUpperCase()}${id.name.slice(1)}`);

    path.scope.path.traverse({
      AssignmentExpression: (path) => {
        if (!t.isIdentifier(path.node.left)) return;
        if (path.node.left === id) return;

        const bindingId = path.scope.getBindingIdentifier(path.node.left.name);
        if (bindingId !== id) return;

        this.assignments.push(path);
      },
    });
  }
}
