import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { HookTransformer } from './transformers/hook_transformers/hook_transformer';

export type StoreConfig = {
  moduleName: string,
  reactModuleName: string,
};

export type ProgramImport = {
  declaration: NodePath<t.ImportDeclaration>,
  specifier: t.ImportSpecifier | t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier,
};

export class Store {
  readonly programImports = new Map<t.Identifier, ProgramImport>();
  readonly depIgnore = new Set<t.Identifier>();
  readonly hooks: HookTransformer[] = [];

  constructor(readonly config: StoreConfig) {
  }
}
