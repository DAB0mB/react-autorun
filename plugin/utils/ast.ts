import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

export type Source = ReturnType<typeof getIdentifierSourceValue>;

const getIdentifierSourceCache = new WeakMap<NodePath<t.Identifier>, Source | null>();

export function getIdentifierSource(path: NodePath<t.Identifier>): Source | null {
  let source = getIdentifierSourceCache.get(path);
  if (source === undefined) {
    source = getIdentifierSourceValue(path);
    getIdentifierSourceCache.set(path, source);
  }

  return source;
}

function getIdentifierSourceValue(path: NodePath<t.Identifier>) {
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
}
