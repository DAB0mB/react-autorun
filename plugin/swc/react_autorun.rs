use std::{collections::HashSet, mem::replace};
use linked_hash_set::LinkedHashSet;
use swc_core::{
    common::DUMMY_SP,
    ecma::{
        ast::*,
        utils::{ExprExt, ExprFactory, quote_ident},
        visit::{as_folder, FoldWith, Visit, VisitMut, VisitMutWith, VisitWith},
    },
    plugin::{plugin_transform, proxies::TransformPluginProgramMetadata},
};

pub struct AutorunTransformer {
    curr_ctxt: u32,
    ignored_hooks: IdentKeySet,
    autorun_imports: ImportsExtractor,
    use_state_imports: ImportsExtractor,
    use_reducer_imports: ImportsExtractor,
    use_ref_imports: ImportsExtractor,
}

impl AutorunTransformer {
    pub fn new() -> Self {
        Self {
            curr_ctxt: 0,
            ignored_hooks: IdentKeySet::new(),
            autorun_imports: ImportsExtractor::new("autorun", "react-autorun"),
            use_state_imports: ImportsExtractor::new("useState", "react"),
            use_reducer_imports: ImportsExtractor::new("useReducer", "react"),
            use_ref_imports: ImportsExtractor::new("useRef", "react"),
        }
    }

    fn visit_mut_call_expr_enter(&mut self, n: &mut CallExpr) {
        let arg0 = match n.args.get(0) {
            Some(el) => el.expr.as_ref(),
            _ => return,
        };

        let arg1 = match n.args.get(1) {
            Some(el) => el.expr.as_ref(),
            _ => return,
        };

        let callback: &dyn VisitWith<dyn Visit> =
            if let Some(callback) = arg0.as_fn_expr() {
                callback
            }
            else if let Some(callback) = arg0.as_arrow() {
                callback
            }
            else {
                return
            };

        let autorun = match arg1.as_ident() {
            Some(ident) => ident,
            _ => return,
        };

        if !self.autorun_imports.specifiers.contains(autorun) {
            return;
        }

        let hook_deps = {
            let mut hook_deps = HookDepsExtractor::new(
                self.curr_ctxt,
                &self.ignored_hooks,
            );
            callback.visit_children_with(&mut hook_deps);
            hook_deps
        };

        let mut deps_args: Vec<Option<ExprOrSpread>> = vec![];
        for dep_name in hook_deps.deps.iter() {
            deps_args.push(
                Some(quote_ident!(dep_name.to_string()).as_arg()),
            );
        }

        let autorun_iife = {
            let mut iife = autorun.clone().as_iife();
            iife.args = vec![
                ArrayLit {
                    span: DUMMY_SP,
                    elems: deps_args,
                }.into_lazy_arrow(vec![]).as_arg(),
            ];
            iife
        };

        n.args[1] = autorun_iife.as_arg();
    }
}

impl VisitMut for AutorunTransformer {
    fn visit_mut_block_stmt(&mut self, n: &mut BlockStmt) {
        let mut ignored_hooks = {
            let ignored_hooks = IgnoredHooksExtractor::new(
                &self.use_state_imports.specifiers,
                &self.use_reducer_imports.specifiers,
                &self.use_ref_imports.specifiers,
            );
            ignored_hooks
        };
        n.visit_children_with(&mut ignored_hooks);

        let prev_ignored_hooks = replace(&mut self.ignored_hooks, ignored_hooks.idents);
        let prev_ctxt = replace(&mut self.curr_ctxt, n.span.ctxt.as_u32());

        n.visit_mut_children_with(self);

        self.curr_ctxt = prev_ctxt;
        self.ignored_hooks = prev_ignored_hooks;
    }

    fn visit_mut_import_decl(&mut self, n: &mut ImportDecl) {
        self.autorun_imports.extract(n);
        self.use_state_imports.extract(n);
        self.use_reducer_imports.extract(n);
        self.use_ref_imports.extract(n);
        n.visit_mut_children_with(self);
    }

    fn visit_mut_call_expr(&mut self, n: &mut CallExpr) {
        self.visit_mut_call_expr_enter(n);
        n.visit_mut_children_with(self);
    }
}

struct ImportsExtractor {
    specifiers: IdentKeySet,
    export_name: String,
    module_name: String,
}

impl ImportsExtractor {
    fn new(id_name: &str, module_name: &str) -> Self {
        Self {
            specifiers: IdentKeySet::new(),
            export_name: String::from(id_name),
            module_name: String::from(module_name),
        }
    }

    fn extract(&mut self, n: &ImportDecl) {
        if n.src.value.to_string() != self.module_name {
            return;
        }

        for specifier in n.specifiers.iter() {
            let named_specifier = match specifier {
                ImportSpecifier::Named(named_specifier) => named_specifier,
                _ => continue,
            };

            let export_id = match &named_specifier.imported {
                Some(ModuleExportName::Ident(export_id)) => export_id,
                _ => &named_specifier.local,
            };
            if get_ident_name(export_id) != self.export_name {
                continue;
            }

            self.specifiers.insert(&named_specifier.local);
        }
    }
}

struct IgnoredHooksExtractor<'a> {
    idents: IdentKeySet,
    use_state_imports: &'a IdentKeySet,
    use_reducer_imports: &'a IdentKeySet,
    use_ref_imports: &'a IdentKeySet,
}

impl <'a>IgnoredHooksExtractor<'a> {
    fn new(
        use_state_imports: &'a IdentKeySet,
        use_reducer_imports: &'a IdentKeySet,
        use_ref_imports: &'a IdentKeySet,
    ) -> Self {
        Self {
            idents: IdentKeySet::new(),
            use_state_imports,
            use_reducer_imports,
            use_ref_imports,
        }
    }
}

impl <'a>Visit for IgnoredHooksExtractor<'a> {
    fn visit_var_declarator(&mut self, n: &VarDeclarator) {
        let init = match &n.init {
            Some(init) => init,
            _ => return,
        };

        let call_expr = match init.as_expr() {
            Expr::Call(call_expr) => call_expr,
            _ => return,
        };

        let callee_expr = match call_expr.callee.as_expr() {
            Some(callee_expr) => callee_expr,
            _ => return,
        };

        let callee = match callee_expr.as_ident() {
            Some(callee) => callee,
            _ => return,
        };

        let is_ref = self.use_ref_imports.contains(&callee);
        if is_ref {
            let id = match n.name.as_ident() {
                Some(ident) => &ident.id,
                _ => return,
            };
            self.idents.insert(id);
            return;
        }

        let is_state =
            self.use_state_imports.contains(&callee) ||
            self.use_reducer_imports.contains(&callee);
        if !is_state {
            return;
        }

        let elems = match n.name.as_array() {
            Some(array) => &array.elems,
            _ => return,
        };

        let id_pat = match elems.get(1) {
            Some(Some(id_pat)) => id_pat,
            _ => return,
        };

        let id = match id_pat.as_ident() {
            Some(binding) => &binding.id,
            _ => return,
        };

        self.idents.insert(id);
    }
}

struct HookDepsExtractor<'a> {
    component_ctxt: u32,
    deps: LinkedHashSet<String>,
    visited_nodes: RefSet,
    callee_member_nodes: RefSet,
    ignored_hooks: &'a IdentKeySet,
}

impl <'a>HookDepsExtractor<'a> {
    fn new(component_ctxt: u32, ignored_hooks: &'a IdentKeySet) -> Self {
        Self {
            component_ctxt,
            ignored_hooks,
            deps: LinkedHashSet::new(),
            visited_nodes: RefSet::new(),
            callee_member_nodes: RefSet::new(),
        }
    }

    fn is_declared_in_component(&self, ident: &Ident) -> bool {
        ident.span.ctxt.as_u32() == self.component_ctxt
    }
}

impl <'a>Visit for HookDepsExtractor<'a> {
    fn visit_callee(&mut self, n: &Callee) {
        let expr = match n.as_expr() {
            Some(expr) => expr,
            _ => return,
        };

        let member = match expr.as_member() {
            Some(member) => member,
            _ => return,
        };

        self.callee_member_nodes.insert(member);
        member.visit_with(self);
    }

    fn visit_member_expr(&mut self, n: &MemberExpr) {
        if self.visited_nodes.contains(n) {
            return;
        }
        self.visited_nodes.insert(n);

        let mut object = n.obj.as_ref();
        let mut props: Vec<&MemberProp> = vec![];
        while let Some(member) = object.as_member() {
            self.visited_nodes.insert(member);
            props.insert(0, &member.prop);
            object = member.obj.as_ref();
        }

        let obj_ident = match object.as_ident() {
            Some(obj_ident) => obj_ident,
            _ => return,
        };

        if !self.is_declared_in_component(obj_ident) {
            return;
        }

        if self.ignored_hooks.contains(obj_ident) {
            return;
        }

        let mut dep = get_ident_name(obj_ident).to_string();
        for prop in props.into_iter() {
            dep.push_str(member_prop_to_path(prop).as_str());
        }

        if self.callee_member_nodes.contains(n) {
            self.deps.insert(dep.clone());
        }

        dep.push_str(member_prop_to_path(&n.prop).as_str());
        self.deps.insert(dep);
    }

    fn visit_ident(&mut self, n: &Ident) {
        if !self.is_declared_in_component(n) {
            return;
        }

        if self.ignored_hooks.contains(n) {
            return;
        }

        self.deps.insert(get_ident_name(n).to_string());
    }
}

fn member_prop_to_path(prop_member: &MemberProp) -> String {
    let mut path = String::from("?.");

    if let Some(ident) = prop_member.as_ident() {
        path.push_str(get_ident_name(ident));
        return path;
    }

    let computed = match prop_member.as_computed() {
        Some(computed) => computed,
        _ => return path,
    };

    path.push('[');

    if let Some(ident) = computed.expr.as_ident() {
        path.push_str(get_ident_name(ident));
    }
    else {
        let value = match computed.expr.as_lit() {
            Some(Lit::Num(num)) => num.value.to_string(),
            Some(Lit::Str(str)) => format!("\"{}\"", str.value.to_string()),
            _ => return path,
        };
        path.push_str(value.as_str());
    }

    path.push(']');

    path
}

struct RefSet {
    hash_set: HashSet<u32>,
}

impl RefSet {
    fn new() -> Self {
        Self {
            hash_set: HashSet::new(),
        }
    }

    fn insert<V>(&mut self, value: &V) {
        self.hash_set.insert(get_pointer_addr(value));
    }

    fn contains<V>(&self, value: &V) -> bool {
        self.hash_set.contains(&get_pointer_addr(value))
    }
}

struct IdentKeySet {
    hash_set: HashSet<String>,
}

impl IdentKeySet {
    fn new() -> Self {
        Self {
            hash_set: HashSet::new(),
        }
    }

    fn insert(&mut self, ident: &Ident) {
        self.hash_set.insert(get_ident_key(ident).to_string());
    }

    fn contains(&self, ident: &Ident) -> bool {
        self.hash_set.contains(&get_ident_key(ident))
    }
}

fn get_ident_name(ident: &Ident) -> &str {
    &*ident.sym
}

fn get_ident_key(ident: &Ident) -> String {
    ident.sym.to_string()
}

fn get_pointer_addr<V>(value: &V) -> u32 {
    value as *const V as u32
}

#[plugin_transform]
pub fn process_transform(program: Program, _metadata: TransformPluginProgramMetadata) -> Program {
    program.fold_with(&mut as_folder(AutorunTransformer::new()))
}
