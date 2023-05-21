import { CodeGenerator } from '@babel/generator';
import { NodePath, Scope, Visitor } from '@babel/traverse';
import * as t from '@babel/types';

export default (): { visitor: Visitor } => {
  let autorunImportSpecifiers!: Map<string, NodePath>;
  let useStateImportSpecifiers!: Map<string, NodePath>;
  let useReducerImportSpecifiers!: Map<string, NodePath>;
  let useRefImportSpecifiers!: Map<string, NodePath>;

  return {
    visitor: {
      Program(program) {
        autorunImportSpecifiers = getImportSpecifiers(program.scope, 'autorun', 'react-autorun');
        useStateImportSpecifiers = getImportSpecifiers(program.scope, 'useState', 'react');
        useReducerImportSpecifiers = getImportSpecifiers(program.scope, 'useReducer', 'react');
        useRefImportSpecifiers = getImportSpecifiers(program.scope, 'useRef', 'react');
      },
      CallExpression(callExpression) {
        const callback = callExpression.get('arguments').at(0);
        if (!callback) return;
        if (!callback.isFunctionExpression() && !callback.isArrowFunctionExpression()) return;

        const autorun = callExpression.get('arguments').at(1);
        if (!autorun || !autorun.isIdentifier()) return;

        const autorunBinding = callExpression.scope.getBinding(autorun.node.name);
        if (!autorunBinding || autorunImportSpecifiers.get(autorun.node.name) !== autorunBinding.path) return;

        // Exclude some dependencies that were yielded from React hooks
        // Source: https://github.com/facebook/react/blob/5309f102854475030fb91ab732141411b49c1126/packages/eslint-plugin-react-hooks/src/ExhaustiveDeps.js#L151
        const deps = getFunctionExpressionDeps(callback, (dep) => {
          const depBidning = callExpression.scope.getOwnBinding(dep);
          if (!depBidning) return true;

          const depVariableDeclarator = depBidning.path;
          if (!depVariableDeclarator.isVariableDeclarator()) return true;

          const depInit = depVariableDeclarator.get('init');
          if (!depInit.isCallExpression()) return true;

          const depCallee = depInit.get('callee');
          if (!depCallee.isIdentifier()) return true;

          const depCalleeBinding = callExpression.scope.getBinding(depCallee.node.name);
          if (!depCalleeBinding) return true;

          const isRef = useRefImportSpecifiers.get(depCallee.node.name) === depCalleeBinding.path;
          if (isRef) return false;

          const isState = (
            useStateImportSpecifiers.get(depCallee.node.name) === depCalleeBinding.path ||
            useReducerImportSpecifiers.get(depCallee.node.name) === depCalleeBinding.path
          );
          if (!isState) return true;

          const depId = depVariableDeclarator.get('id');
          if (!depId.isArrayPattern()) return true;

          const [, depSetStateId] = depId.get('elements');
          if (!depSetStateId?.isIdentifier()) return true;

          return dep !== depSetStateId.node.name;
        });

        autorun.replaceWith(
          t.callExpression(autorun.node, [
            t.arrowFunctionExpression([],
              t.arrayExpression(
                deps.map(dep => t.identifier(dep)),
              ),
            ),
          ]),
        );
      },
    },
  };
};

function getImportSpecifiers(scope: Scope, idName: string, moduleName: string) {
  const specifiers = new Map<string, NodePath>();

  scope.path.traverse({
    // ES modules
    ImportDeclaration(importDeclaration) {
      if (!importDeclaration.get('source').isStringLiteral({ value: moduleName })) return;

      for (const specifier of importDeclaration.get('specifiers')) {
        if (specifier.isImportSpecifier() && specifier.get('imported').isIdentifier({ name: idName })) {
          specifiers.set(specifier.node.local.name, specifier);
        }
      }
    },
    // CommonJS
    VariableDeclarator(variableDeclarator) {
      const init = variableDeclarator.get('init');
      if (!init.isCallExpression()) return;
      if (!init.get('callee').isIdentifier({ name: 'require' })) return;
      if (!init.get('arguments').at(0)?.isStringLiteral({ value: moduleName })) return;

      const id = variableDeclarator.get('id');
      if (!id.isObjectPattern()) return;

      for (const property of id.get('properties')) {
        if (!property.isObjectProperty()) continue;

        const key = property.get('key');
        const value = property.get('value');

        if (key.isIdentifier({ name: idName }) && value.isIdentifier()) {
          specifiers.set(value.node.name, variableDeclarator);
        }
      }
    },
  });

  return specifiers;
}

function getFunctionExpressionDeps(
  path: NodePath<t.ArrowFunctionExpression | t.FunctionExpression>,
  filterFn: (dep: string) => boolean = () => true,
) {
  const deps = new Set<string>();

  path.get('body').traverse({
    MemberExpression: (memberExpression) => {
      if (t.isMemberExpression(memberExpression.parent)) return;

      let object: t.Node = memberExpression.node;
      const props: string[] = [];
      while (t.isMemberExpression(object)) {
        props.unshift(object.computed ? `?.[${generate(object.property)}]` : `?.${(object.property as t.Identifier).name}`);
        object = object.object;
      }

      if (!t.isIdentifier(object)) return;
      if (!path.scope.parent.getOwnBinding(object.name)) return;
      if (!filterFn(object.name)) return;

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
      if (!filterFn(dep)) return;

      deps.add(dep);
    },
  });

  return Array.from(deps);
}

function generate(ast: t.Node) {
  return new CodeGenerator(ast, {
    minified: true,
  }).generate().code;
}
