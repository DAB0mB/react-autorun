import { CodeGenerator } from '@babel/generator';
import * as t from '@babel/types';
import { HookNode, HookTransformer } from './hook_transformer.js';

export class UseCallbackTransformer extends HookTransformer {
  readonly deps = new Set<string>();
  node?: HookNode;

  transform() {
    if (!this.node) return;

    this.node.arguments.push(
      t.arrayExpression(
        [...this.deps].map(t.identifier)
      )
    );
  }

  traverse() {
    this.node = this.path.node;
    const scope = this.path.scope;

    const callback = this.path.node.arguments[0];
    if (!t.isArrowFunctionExpression(callback) && !t.isFunctionExpression(callback)) return;

    this.path.traverse({
      MemberExpression: (path) => {
        if (t.isMemberExpression(path.parent)) return;

        let object: t.Node = path.node;
        const props: string[] = [];
        while (t.isMemberExpression(object)) {
          props.unshift(object.computed ? `[${generate(object.property)}]` : `.${(object.property as t.Identifier).name}`);
          object = object.object;
        }

        if (!t.isIdentifier(object)) return;
        if (!scope.getOwnBinding(object.name)) return;

        let dep = object.name;
        while (props.length > 1) {
          dep += props.shift();
        }

        this.deps.add(dep + props.shift());
        if (t.isCallExpression(path.parentPath.node)) {
          this.deps.add(dep);
        }
      },

      Identifier: (path) => {
        if (t.isMemberExpression(path.parent)) return;
        if (!scope.getOwnBinding(path.node.name)) return;

        this.deps.add(path.node.name);
      },
    });
  }
}

function generate(ast: t.Node) {
  return new CodeGenerator(ast, {
    minified: true,
  }).generate().code;
}
