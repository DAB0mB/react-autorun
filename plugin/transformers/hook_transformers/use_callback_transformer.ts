import { CodeGenerator } from '@babel/generator';
import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { getIdentifierSource } from '../../utils/ast.js';
import { weakMemo } from '../../utils/function.js';
import { HookTransformer } from './hook_transformer.js';

export class UseCallbackTransformer extends HookTransformer {
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
        while (props.length > 1) {
          dep += props.shift();
        }

        this.addDep(dep + props.shift());
        if (t.isCallExpression(path.parentPath.node)) {
          this.addDep(dep);
        }
      },

      Identifier: (path) => {
        if (t.isMemberExpression(path.parent)) return;
        if (!this.path.scope.getOwnBinding(path.node.name)) return;

        this.addDep(path.node.name);
      },
    });
  }

  addDep(dep: string) {
    const depsIgnore = this.getDepsIgnore();

    if (!depsIgnore.has(dep)) {
      this.deps.add(dep);
    }
  }

  private readonly getDepsIgnore = weakMemo(() => {
    const depsIgnore = new Set<string>();

    this.path.scope.path.traverse({
      VariableDeclarator: (path) => {
        const init = path.get('init');
        if (!init.isCallExpression()) return;

        let id: NodePath<t.Identifier>;
        let hookType: string;
        const callee = init.get('callee');
        if (callee.isIdentifier()) {
          id = callee;
          hookType = id.node.name;
        }
        else if (callee.isMemberExpression()) {
          const object = callee.get('object');
          if (!object.isIdentifier()) return;

          const property = callee.get('property');
          if (!property.isIdentifier()) return;

          id = object;
          hookType = property.node.name;
        }
        else {
          return;
        }

        const source = getIdentifierSource(id);
        if (!source) return;

        const sourceModuleName = source.declaration.source.value;
        if (sourceModuleName === this.config.moduleName) {
          switch (hookType) {
            case 'useRef': {
              const left = path.get('id');
              if (!left.isIdentifier()) return;

              depsIgnore.add(left.node.name);
              return;
            }
          }

          return;
        }

        if (sourceModuleName === this.config.reactModuleName) {
          switch (hookType) {
            case 'useReducer':
            case 'useState': {
              const left = path.get('id');
              if (!left.isArrayPattern()) return;

              const [, setterId] = left.get('elements');
              if (!setterId.isIdentifier()) return;

              depsIgnore.add(setterId.node.name);
              return;
            }
            case 'useId': {
              const left = path.get('id');
              if (!left.isIdentifier()) return;

              depsIgnore.add(left.node.name);
              return;
            }
            case 'useRef': {
              const left = path.get('id');
              if (!left.isIdentifier()) return;

              depsIgnore.add(left.node.name);
              depsIgnore.add(`${left.node.name}.current`);
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
