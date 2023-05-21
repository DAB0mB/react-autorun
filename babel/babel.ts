import { CodeGenerator } from '@babel/generator';
import { NodePath, Scope, Visitor } from '@babel/traverse';
import * as t from '@babel/types';

export default (): { visitor: Visitor } => {
  const depsByAutorun = new Map<NodePath<t.Identifier>, string[]>();
  let autorunImportSpecifiers!: Map<string, NodePath>;

  return {
    visitor: {
      Program(program) {
        autorunImportSpecifiers = getAutorunImportSpecifiers(program.scope);
      },
      CallExpression(callExpression) {
        const callback = callExpression.get('arguments').at(0);
        if (!callback) return;
        if (!callback.isFunctionExpression() && !callback.isArrowFunctionExpression()) return;

        const autorun = callExpression.get('arguments').at(1);
        if (!autorun || !autorun.isIdentifier()) return;

        const autorunBinding = callExpression.scope.getBinding(autorun.node.name);
        if (!autorunBinding || autorunImportSpecifiers.get(autorun.node.name) !== autorunBinding.path) return;

        const deps = getFunctionExpressionDeps(callback);
        depsByAutorun.set(autorun, Array.from(deps));

        autorun.replaceWith(
          t.callExpression(
            autorun.node,
            [
              t.arrowFunctionExpression(
                [],
                t.arrayExpression(
                  Array.from(deps).map(dep => t.identifier(dep)),
                ),
              ),
            ],
          )
        );
      },
    },
  };
};

function getAutorunImportSpecifiers(scope: Scope) {
  const specifiers = new Map<string, NodePath>();

  scope.path.traverse({
    // ES modules
    ImportDeclaration(importDeclaration) {
      if (!importDeclaration.get('source').isStringLiteral({ value: 'react-autorun' })) return;

      for (const specifier of importDeclaration.get('specifiers')) {
        if (specifier.isImportSpecifier() && specifier.get('imported').isIdentifier({ name: 'autorun' })) {
          specifiers.set(specifier.node.local.name, specifier);
        }
      }
    },
    // CommonJS
    VariableDeclarator(variableDeclarator) {
      const init = variableDeclarator.get('init');
      if (!init.isCallExpression()) return;
      if (!init.get('callee').isIdentifier({ name: 'require' })) return;
      if (!init.get('arguments').at(0)?.isStringLiteral({ value: 'react-autorun' })) return;

      const id = variableDeclarator.get('id');
      if (!id.isObjectPattern()) return;

      for (const property of id.get('properties')) {
        if (!property.isObjectProperty()) continue;

        const key = property.get('key');
        const value = property.get('value');

        if (key.isIdentifier({ name: 'autorun' }) && value.isIdentifier()) {
          specifiers.set(value.node.name, variableDeclarator);
        }
      }
    },
  });

  return specifiers;
}

function getFunctionExpressionDeps(path: NodePath<t.ArrowFunctionExpression | t.FunctionExpression>) {
  const deps = new Set<string>();

  path.get('body').traverse({
    MemberExpression: (memberExpression) => {
      if (t.isMemberExpression(memberExpression.parent)) return;

      let object: t.Node = memberExpression.node;
      const props: string[] = [];
      while (t.isMemberExpression(object)) {
        props.unshift(object.computed ? `[${generate(object.property)}]` : `.${(object.property as t.Identifier).name}`);
        object = object.object;
      }

      if (!t.isIdentifier(object)) return;
      if (!path.scope.parent.getOwnBinding(object.name)) return;

      let dep = object.name;
      while (props.length > 1) {
        dep += props.shift();
      }

      deps.add(dep + props.shift());
      if (t.isCallExpression(memberExpression.parentPath.node)) {
        deps.add(dep);
      }
    },

    Identifier: (identifier) => {
      if (t.isMemberExpression(identifier.parent)) return;

      const dep = identifier.node.name;
      if (!path.scope.parent.getOwnBinding(dep)) return;

      deps.add(dep);
    },
  });

  return deps;
}

function generate(ast: t.Node) {
  return new CodeGenerator(ast, {
    minified: true,
  }).generate().code;
}
