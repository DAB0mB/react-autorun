import { NodePath, Scope } from '@babel/traverse';
import * as t from '@babel/types';
import { Config } from '../config.js';
import { HookTransformer } from './hook_transformers/hook_transformer.js';
import { createHookTransformer } from './hook_transformers/index.js';
import { Transformer } from './transformer.js';
import { weakMemo } from '../utils/function.js';
import { z } from 'zod';
import { CodeGenerator } from '@babel/generator';

export class ProgramTransformer extends Transformer {
  readonly moduleImportDeclarations: t.ImportDeclaration[] = [];
  readonly hooks: HookTransformer[] = [];

  constructor(readonly path: NodePath<t.Program>, config: Config) {
    super(path, config);
  }

  transform() {
    for (const hook of this.hooks) {
      hook.transform();
    }

    for (const importDeclaration of this.moduleImportDeclarations) {
      importDeclaration.source.value = this.config.getModuleName('react');
    }
  }

  traverse() {
    const depsByAutorun = new Map<NodePath, string[]>();
    let autorunImportSpecifiers!: Set<NodePath>;

    this.path.traverse({
      Program: {
        enter: (program) => {
          autorunImportSpecifiers = getAutorunImportSpecifiers(program.scope);
        },
        exit: (program) => {
          for (const [autorun, deps] of depsByAutorun) {
            autorun.replaceWith(

            ),
          }
        },
      },
      CallExpression: (callExpression) => {
        const callback = callExpression.get('arguments')[0];
        if (!callback.isFunctionExpression() && !callback.isArrowFunctionExpression()) return;

        const autorun = callExpression.get('arguments')[1];
        if (!autorun.isIdentifier()) return;

        const autorunBinding = callExpression.scope.getBinding(autorun.node.name);
        if (!autorunBinding || !autorunImportSpecifiers.has(autorunBinding.path)) return;

        const deps = getFunctionExpressionDeps(callback);
        depsByAutorun.set(autorun, Array.from(deps));
      },
    });
  }
}

function getAutorunImportSpecifiers(scope: Scope) {
  const specifiers = new Set<NodePath<t.ImportSpecifier>>();

  scope.path.traverse({
    ImportDeclaration: (importDeclaration) => {
      if (importDeclaration.get('source').get('value') !== 'react-autorun') return;

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

  path.traverse({
    MemberExpression: (memberExpression) => {
      if (t.isMemberExpression(memberExpression.parent)) return;

      let object: t.Node = memberExpression.node;
      const props: string[] = [];
      while (t.isMemberExpression(object)) {
        props.unshift(object.computed ? `[${generate(object.property)}]` : `.${(object.property as t.Identifier).name}`);
        object = object.object;
      }

      if (!t.isIdentifier(object)) return;
      if (!path.scope.getOwnBinding(object.name)) return;

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

      const dep = identifier.node.name
      if (!path.scope.getOwnBinding(dep)) return;

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
