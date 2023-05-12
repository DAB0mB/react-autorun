import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { HookNode, HookTransformer } from './hook_transformer.js';

export class UseRefTransformer extends HookTransformer {
  id?: t.Identifier;
  readonly assignments: NodePath<t.AssignmentExpression>[] = [];

  transform() {
    if (!this.id) return;

    for (const assignment of this.assignments) {
      assignment.replaceWith(
        t.assignmentExpression(
          assignment.node.operator,
          t.memberExpression(
            this.id,
            t.identifier('current'),
          ),
          assignment.node.right,
        ),
      );
    }
  }

  traverse(path: NodePath<HookNode>) {
    const variable = t.isVariableDeclarator(path.parentPath.node) ? path.parentPath as NodePath<t.VariableDeclarator> : undefined;
    if (!variable) return;

    const id = this.id = t.isIdentifier(variable.node.id) ? variable.node.id : undefined;
    if (!id) return;

    path.scope.path.traverse({
      AssignmentExpression: (path) => {
        if (!t.isIdentifier(path.node.left)) return;

        const bindingId = path.scope.getBindingIdentifier(path.node.left.name);
        if (bindingId !== id) return;

        this.assignments.push(path);
      },
    });
  }
}
