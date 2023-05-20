import { CodeGenerator } from '@babel/generator';
import { NodePath, Scope, Visitor } from '@babel/traverse';
import * as t from '@babel/types';

export default (): { visitor: Visitor } => {
  const depsByAutorun = new Map<NodePath<t.Identifier>, string[]>();
  let autorunImportSpecifiers!: Set<NodePath>;

  return {
    visitor: {
      Program: {
        enter: (program) => {
          autorunImportSpecifiers = getAutorunImportSpecifiers(program.scope);
        },
        exit: () => {
          for (const [autorun, deps] of depsByAutorun) {
            autorun.replaceWith(
              t.callExpression(
                autorun.node,
                [
                  t.arrowFunctionExpression(
                    [],
                    t.arrayExpression(
                      deps.map(dep => t.identifier(dep)),
                    ),
                  ),
                ],
              )
            );
          }
        },
      },
      CallExpression: (callExpression) => {
        const callback = callExpression.get('arguments')[0];
        if (!callback) return;
        if (!callback.isFunctionExpression() && !callback.isArrowFunctionExpression()) return;

        const autorun = callExpression.get('arguments')[1];
        if (!autorun || !autorun.isIdentifier()) return;

        const autorunBinding = callExpression.scope.getBinding(autorun.node.name);
        if (!autorunBinding || !autorunImportSpecifiers.has(autorunBinding.path)) return;

        const deps = getFunctionExpressionDeps(callback);
        depsByAutorun.set(autorun, Array.from(deps));
      },
    },
  };
};

function getAutorunImportSpecifiers(scope: Scope) {
  const specifiers = new Set<NodePath<t.ImportSpecifier>>();

  scope.path.traverse({
    ImportDeclaration: (importDeclaration) => {
      if (!importDeclaration.get('source').isStringLiteral({ value: 'react-autorun' })) return;

      for (const specifier of importDeclaration.get('specifiers')) {
        if (specifier.isImportSpecifier() && specifier.get('imported').isIdentifier({ name: 'autorun' })) {
          specifiers.add(specifier);
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
