import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { weakMemo } from './function.js';

export const getBindingImport = weakMemo((path: NodePath<t.Identifier>) => {
  const binding = path.scope.getBinding(path.node.name);
  if (!binding) return null;

  let id: t.Identifier;
  const specifier = binding.path.node;
  if (t.isImportSpecifier(specifier)) {
    if (!t.isIdentifier(specifier.imported)) return null;
    id = specifier.imported;
  }
  else if (t.isImportDefaultSpecifier(specifier)) {
    id = specifier.local;
  }
  else if (t.isImportNamespaceSpecifier(specifier)) {
    id = specifier.local;
  }
  else {
    return null;
  }

  const declaration = binding.path.parent;
  if (!declaration || !t.isImportDeclaration(declaration)) return null;

  return {
    id,
    alias: specifier.local,
    specifier,
    declaration,
  };
});

export const getImportedMember = weakMemo((path: NodePath) => {
  let id: NodePath<t.Identifier>;
  let name: string;
  if (path.isIdentifier()) {
    id = path;
    name = id.node.name;
  }
  else if (path.isMemberExpression()) {
    const object = path.get('object');
    if (!object.isIdentifier()) return;

    const property = path.get('property');
    if (!property.isIdentifier()) return;

    id = object;
    name = property.node.name;
  }
  else {
    return;
  }

  const source = getBindingImport(id);
  if (!source) return;

  return {
    path,
    source,
    name,
  };
});
