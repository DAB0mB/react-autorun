use std::{collections::{HashSet}};
use swc_core::{ecma::{
    ast::*,
    utils::{ExprFactory, quote_ident, ExprExt},
    visit::{as_folder, FoldWith, VisitMut, VisitMutWith, Visit, VisitWith},
}, common::{DUMMY_SP}};
use swc_core::plugin::{plugin_transform, proxies::TransformPluginProgramMetadata};

struct AutorunTransformer {
    ctxt_stack: Vec<u32>,
    parent_ctxt: u32,
    autorun_imports: ImportsExtractor,
    use_state_imports: ImportsExtractor,
    use_reducer_imports: ImportsExtractor,
    use_ref_imports: ImportsExtractor,
}

impl AutorunTransformer {
    fn new() -> Self {
        Self {
            ctxt_stack: vec![1],
            parent_ctxt: 0,
            autorun_imports: ImportsExtractor::new("autorun", "react-autorun"),
            use_state_imports: ImportsExtractor::new("useState", "react"),
            use_reducer_imports: ImportsExtractor::new("useRef", "react"),
            use_ref_imports: ImportsExtractor::new("useReducer", "react"),
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

        if !self.autorun_imports.contains(autorun) {
            return;
        }

        let ignored_hooks = {
            let mut ignored_hooks = IgnoredHooksExtractor::new(
                &self.use_state_imports,
                &self.use_reducer_imports,
                &self.use_ref_imports,
            );
            callback.visit_children_with(&mut ignored_hooks);
            ignored_hooks
        };

        let hook_deps = {
            let mut hook_deps = HookDepsExtractor::new(
                self.parent_ctxt,
                &ignored_hooks,
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
        if let Some(last) = self.ctxt_stack.last() {
            self.parent_ctxt = last.clone();
        }

        self.ctxt_stack.push(n.span.ctxt.as_u32());
        n.visit_mut_children_with(self);

        if let Some(pop) = self.ctxt_stack.pop() {
            self.parent_ctxt = pop;
        }
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
    specifiers: HashSet<String>,
    export_name: String,
    module_name: String,
}

impl ImportsExtractor {
    fn new(id_name: &str, module_name: &str) -> Self {
        Self {
            specifiers: HashSet::new(),
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
            if export_id.to_string() != self.export_name {
                continue;
            }

            self.specifiers.insert(get_ident_key(&named_specifier.local));
        }
    }

    fn contains(&self, ident: &Ident) -> bool {
        let key = get_ident_key(ident);
        self.specifiers.contains(&key)
    }
}

struct IgnoredHooksExtractor<'a> {
    idents: HashSet<String>,
    use_state_imports: &'a ImportsExtractor,
    use_reducer_imports: &'a ImportsExtractor,
    use_ref_imports: &'a ImportsExtractor,
}

impl <'a> IgnoredHooksExtractor<'a> {
    fn new(
        use_state_imports: &'a ImportsExtractor,
        use_reducer_imports: &'a ImportsExtractor,
        use_ref_imports: &'a ImportsExtractor,
    ) -> Self {
        Self {
            idents: HashSet::new(),
            use_state_imports,
            use_reducer_imports,
            use_ref_imports,
        }
    }

    fn contains(&self, ident: &Ident) -> bool {
        let key = get_ident_key(ident);
        self.idents.contains(&key)
    }
}

impl <'a> Visit for IgnoredHooksExtractor<'a> {
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

        let is_ref = self.use_ref_imports.contains(callee);
        if is_ref {
            let id = match n.name.as_ident() {
                Some(ident) => &ident.id,
                _ => return,
            };
            self.idents.insert(get_ident_key(id));
            return;
        }

        let is_state =
            self.use_state_imports.contains(callee) ||
            self.use_reducer_imports.contains(callee);
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

        self.idents.insert(get_ident_key(id));
    }
}

struct HookDepsExtractor<'a> {
    component_ctxt: u32,
    deps: HashSet<String>,
    visited_nodes: RefSet,
    callee_member_nodes: RefSet,
    ignored_hooks: &'a IgnoredHooksExtractor<'a>,
}

impl <'a> HookDepsExtractor<'a> {
    fn new(component_ctxt: u32, ignored_hooks: &'a IgnoredHooksExtractor<'a>) -> Self {
        Self {
            component_ctxt,
            ignored_hooks,
            deps: HashSet::new(),
            visited_nodes: RefSet::new(),
            callee_member_nodes: RefSet::new(),
        }
    }

    fn is_declared_in_component(&self, ident: &Ident) -> bool {
        ident.span.ctxt.as_u32() == self.component_ctxt
    }
}

impl <'a> Visit for HookDepsExtractor<'a> {
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
        member.visit_children_with(self);
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

        if !self.ignored_hooks.contains(obj_ident) {
            return;
        }

        let mut dep = obj_ident.to_string();
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

        self.deps.insert(n.to_string());
    }
}

fn member_prop_to_path(prop_member: &MemberProp) -> String {
    let mut path = String::from("?.");

    if let Some(ident) = prop_member.as_ident() {
        path.push_str(ident.sym.to_string().as_str());
        return path;
    }

    let computed = match prop_member.as_computed() {
        Some(computed) => computed,
        _ => return path,
    };

    path.push('[');

    if let Some(ident) = computed.expr.as_ident() {
        path.push_str(ident.sym.to_string().as_str());
    }
    else {
        let value = match computed.expr.as_lit() {
            Some(Lit::Num(num)) => num.value.to_string(),
            Some(Lit::Str(str)) => str.value.to_string(),
            _ => return path,
        };
        path.push_str(value.as_str());
    }

    path.push(']');

    path
}

pub struct RefSet {
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

fn get_ident_key(ident: &Ident) -> String {
    let mut mut_specifier = String::new();
    mut_specifier.push_str(ident.sym.to_string().as_str());
    mut_specifier.push_str(ident.span.ctxt.as_u32().to_string().as_str());
    let specifier = mut_specifier;
    specifier
}

fn get_pointer_addr<V>(value: &V) -> u32 {
    value as *const V as u32
}

#[plugin_transform]
pub fn process_transform(program: Program, _metadata: TransformPluginProgramMetadata) -> Program {
    program.fold_with(&mut as_folder(AutorunTransformer::new()))
}
