mod react_autorun;

use serde::{Deserialize, Serialize};
use std::{
    error::Error,
    fs::File,
    io::Read,
    path::{Path, PathBuf},
};

use react_autorun::AutorunTransformer;
use swc_core::{
    common::{chain, Mark},
    ecma::{
        ast::*,
        transforms::{base::resolver, testing::{test, test_fixture}},
        utils::{ExprFactory, quote_ident},
        visit::{as_folder, VisitMut, VisitMutWith},
    },
};

#[testing::fixture("../test/fixture/**/input.ts")]
fn fixture(input: PathBuf) {
    let dirname = input.parent().unwrap();
    let output = dirname.join("output.ts");
    let config = dirname.join("config.json");
    let config: Config = Config::from_file(&config).unwrap();

    test_fixture(
        Default::default(),
        &|_| {
            chain!(
                resolver(Mark::new(), Mark::new(), true),
                as_folder(AutorunTransformer::new()),
                as_folder(PluckAutorunCallExpr::new(&config)),
            )
        },
        &input,
        &output,
        Default::default(),
    );
}

#[derive(Deserialize, Serialize, Debug)]
struct Config {
    #[serde(default = "default_autorun_symbol")]
    autorun_symbol: String,
}

fn default_autorun_symbol() -> String {
    "autorun".to_string()
}

impl Config {
    fn from_file<P: AsRef<Path>>(path: &P) -> Result<Self, Box<dyn Error>> {
        let config_path = path.as_ref();

        let mut contents = String::new();
        if config_path.exists() {
            let mut file = File::open(config_path)?;
            file.read_to_string(&mut contents)?;
        }
        else {
            contents.push_str(r#"{}"#);
        }

        let config: Config = serde_json::from_str(&contents)?;
        Ok(config)
    }
}

struct PluckAutorunCallExpr<'a> {
    config: &'a Config,
    autorun_call_expr: Option<CallExpr>,
}

impl <'a> PluckAutorunCallExpr<'a> {
    fn new(config: &'a Config) -> Self {
        Self {
            config,
            autorun_call_expr: None,
        }
    }

    fn visit_mut_call_expr_enter(&mut self, n: &mut CallExpr) {
        let callee_expr = match n.callee.as_expr() {
            Some(callee_expr) => callee_expr,
            _ => return,
        };

        let callee = match callee_expr.as_ident() {
            Some(callee) => callee,
            _ => return,
        };

        if callee.sym.to_string() != self.config.autorun_symbol {
            return;
        }

        self.autorun_call_expr.replace(n.clone());
    }
}

impl <'a> VisitMut for PluckAutorunCallExpr<'a> {
    fn visit_mut_module(&mut self, n: &mut Module) {
        n.visit_mut_children_with(self);
        n.body = vec![
            ModuleItem::Stmt(
                if let Some(autorun_call_expr) = self.autorun_call_expr.take() {
                    autorun_call_expr.into_stmt()
                }
                else {
                    quote_ident!("AUTORUN_NOT_FOUND").into_stmt()
                }
            )
        ];
    }

    fn visit_mut_call_expr(&mut self, n: &mut CallExpr) {
        self.visit_mut_call_expr_enter(n);
        if self.autorun_call_expr == None {
            n.visit_mut_children_with(self);
        }
    }
}
