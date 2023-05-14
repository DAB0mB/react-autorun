import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { HookTransformer } from './hook_transformer.js';

export class UseStateTransformer extends HookTransformer {
  readonly variable = t.isVariableDeclarator(this.path.parentPath.node) ? this.path.parentPath as NodePath<t.VariableDeclarator> : undefined;
  readonly id = this.variable && t.isIdentifier(this.variable.node.id) ? this.variable.node.id : undefined;
  readonly setterId = this.id && this.path.scope.generateUidIdentifier(`set${this.id.name.charAt(0).toUpperCase()}${this.id.name.slice(1)}`);
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

  traverse() {
    this.path.scope.path.traverse({
      AssignmentExpression: (path) => {
        if (!t.isIdentifier(path.node.left)) return;
        if (path.node.left === this.id) return;

        const bindingId = path.scope.getBindingIdentifier(path.node.left.name);
        if (bindingId !== this.id) return;

        this.assignments.push(path);
      },
    });
  }
}
