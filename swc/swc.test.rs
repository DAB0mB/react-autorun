use swc_core::ecma::{transforms::testing::test_fixture, visit::as_folder};
use react_autorun::AutorunTransformer;

use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fs::File;
use std::io::Read;
use std::path::Path;

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

#[testing::fixture("../test/fixture/**/input.ts")]
fn fixture(input: PathBuf) {
    let dirname = input.parent().unwrap();
    let output = dirname.join("output.ts");
    let config_path = dirname.join("config.json");
    let config = Config::from_file(&config_path);

    // TODO: Extract autorun call expression

    test_fixture(
        Default::default(),
        &|program| program.fold_with(&mut as_folder(AutorunTransformer::new())),
        &input,
        &output,
        Default::default(),
    );
}
