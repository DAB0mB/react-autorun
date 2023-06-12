import { NodePath, Scope, Visitor, visitors } from '@babel/traverse';
import * as t from '@babel/types';

export default function () {
  const autorunImportSpecifiers = getImportSpecifiers('autorun', 'react-autorun');
  const useStateImportSpecifiers = getImportSpecifiers('useState', 'react');
  const useReducerImportSpecifiers = getImportSpecifiers('useReducer', 'react');
  const useRefImportSpecifiers = getImportSpecifiers('useRef', 'react');

  const visitor: Visitor = {
    CallExpression(callExpression) {
      const callback = callExpression.get('arguments').at(0);
      if (!callback) return;
      if (!callback.isFunctionExpression() && !callback.isArrowFunctionExpression()) return;

      const autorun = callExpression.get('arguments').at(1);
      if (!autorun || !autorun.isIdentifier()) return;

      const autorunBinding = callExpression.scope.getBinding(autorun.node.name);
      if (!autorunBinding || autorunImportSpecifiers.get(autorun.node.name) !== autorunBinding.path) return;

      const deps = getFunctionExpressionDeps(callback, dep => filterReactDeps(callExpression.scope, dep));

      autorun.replaceWith(
        t.callExpression(autorun.node, [
          t.arrowFunctionExpression([],
            t.arrayExpression(
              deps.map(t.identifier),
            ),
          ),
        ]),
      );
    },
  };

  // Exclude some dependencies that were yielded from React hooks
  // Source: https://github.com/facebook/react/blob/5309f102854475030fb91ab732141411b49c1126/packages/eslint-plugin-react-hooks/src/ExhaustiveDeps.js#L151
  const filterReactDeps = (scope: Scope, dep: string) => {
    const depBidning = scope.getOwnBinding(dep);
    if (!depBidning) return true;

    const depVariableDeclarator = depBidning.path;
    if (!depVariableDeclarator.isVariableDeclarator()) return true;

    const depInit = depVariableDeclarator.get('init');
    if (!depInit.isCallExpression()) return true;

    const depCallee = depInit.get('callee');
    if (!depCallee.isIdentifier()) return true;

    const depCalleeBinding = scope.getBinding(depCallee.node.name);
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
  };

  return {
    visitor: visitors.merge([
      autorunImportSpecifiers.visitor,
      useStateImportSpecifiers.visitor,
      useReducerImportSpecifiers.visitor,
      useRefImportSpecifiers.visitor,
      visitor,
    ]),
  };
}

function getImportSpecifiers(idName: string, moduleName: string) {
  const specifiers = new Map<string, NodePath>();

  const visitor: Visitor = {
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
  };

  return Object.assign(specifiers, { visitor });
}

function getFunctionExpressionDeps(
  path: NodePath<t.ArrowFunctionExpression | t.FunctionExpression>,
  filterFn: (dep: string) => boolean = () => true,
) {
  const deps = new Set<string>();

  path.get('body').traverse({
    MemberExpression(memberExpression) {
      if (t.isMemberExpression(memberExpression.parent)) return;

      let object: t.Node = memberExpression.node;
      const props: string[] = [];
      while (t.isMemberExpression(object)) {
        const prop = memberExprToProp(object);
        if (!prop) return;

        props.unshift(prop);
        object = object.object;
      }

      if (!t.isIdentifier(object)) return;
      if (!path.scope.parent.getOwnBinding(object.name)) return;
      if (!filterFn(object.name)) return;

      let dep = object.name;
      while (props.length > 1) {
        dep += props.shift();
      }

      if (t.isCallExpression(memberExpression.parentPath.node)) {
        deps.add(dep);
      }
      deps.add(dep + props.shift());
    },

    Identifier(identifier) {
      if (t.isMemberExpression(identifier.parent)) return;

      const dep = identifier.node.name;
      if (!path.scope.parent.getOwnBinding(dep)) return;
      if (!filterFn(dep)) return;

      deps.add(dep);
    },
  });

  return Array.from(deps);
}

function memberExprToProp(member: t.MemberExpression) {
  if (member.computed) {
    let computedExpr: string;

    if (t.isNumericLiteral(member.property)) {
      computedExpr = member.property.value.toString();
    }
    else if (t.isStringLiteral(member.property)) {
      computedExpr = `"${member.property.value}"`;
    }
    else if (t.isIdentifier(member.property)) {
      computedExpr = member.property.name;
    }
    else {
      return;
    }

    return `?.[${computedExpr}]`;
  }
  if (t.isIdentifier(member.property)) {
    return `?.${member.property.name}`;
  }

  return;
}
