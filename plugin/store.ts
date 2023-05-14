import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { HookTransformer } from './transformers/hook_transformers/hook_transformer';

export type StoreConfig = {
  moduleName: string,
  reactModuleName: string,
};

export class Store {
  readonly moduleImportDeclarations = new Map<t.Identifier, NodePath<t.ImportDeclaration>>();
  readonly hooks: HookTransformer[] = [];

  constructor(readonly config: StoreConfig) {
  }
}
