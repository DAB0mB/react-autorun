import { CodeGenerator } from '@babel/generator';
import * as t from '@babel/types';
import { getImportedMember } from '../../utils/ast.js';
import { weakMemo } from '../../utils/function.js';
import { HookTransformer } from './hook_transformer.js';

export class DependentHookTransformer extends HookTransformer {
  readonly deps = new Set<string>();

  transform() {
    this.path.node.arguments.push(
      t.arrayExpression(
        [...this.deps].map(t.identifier)
      )
    );
  }

  traverse() {
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
        if (!this.path.scope.getOwnBinding(object.name)) return;

        let dep = object.name;
        if (this.getDepsIgnore().has(dep)) return;

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

        const dep = path.node.name
        if (!this.path.scope.getOwnBinding(dep)) return;
        if (this.getDepsIgnore().has(dep)) return;

        this.deps.add(dep);
      },
    });
  }

  private readonly getDepsIgnore = weakMemo(() => {
    const depsIgnore = new Set<string>();

    this.path.scope.path.traverse({
      VariableDeclarator: (path) => {
        const init = path.get('init');
        if (!init.isCallExpression()) return;

        const callee = init.get('callee');
        const hook = getImportedMember(callee);
        if (!hook) return;

        const sourceModuleName = hook.source.declaration.source.value;
        if (sourceModuleName === this.config.moduleName) {
          switch (hook.name) {
            case 'useRef': {
              const left = path.get('id');
              if (!left.isIdentifier()) return;

              depsIgnore.add(left.node.name);
              return;
            }
          }
        }
        else if (sourceModuleName === this.config.reactModuleName) {
          switch (hook.name) {
            case 'useReducer':
            case 'useState': {
              const left = path.get('id');
              if (!left.isArrayPattern()) return;

              const [, setterId] = left.get('elements');
              if (!setterId.isIdentifier()) return;

              depsIgnore.add(setterId.node.name);
              return;
            }
            case 'useId':
            case 'useRef': {
              const left = path.get('id');
              if (!left.isIdentifier()) return;

              depsIgnore.add(left.node.name);
              return;
            }
          }
        }
      }
    });

    return depsIgnore;
  }, () => this.path.scope);
}

function generate(ast: t.Node) {
  return new CodeGenerator(ast, {
    minified: true,
  }).generate().code;
}