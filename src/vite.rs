use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;

use serde::Deserialize;

#[derive(Debug, Clone)]
pub struct ViteAssets {
    hot_file: PathBuf,
    manifest_path: PathBuf,
    entry: String,
}

impl Default for ViteAssets {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Deserialize)]
struct ManifestEntry {
    file: String,
    #[serde(default)]
    css: Vec<String>,
    #[serde(default)]
    imports: Vec<String>,
}

impl ViteAssets {
    pub fn new() -> Self {
        Self {
            hot_file: PathBuf::from("public/hot"),
            manifest_path: PathBuf::from("public/build/manifest.json"),
            entry: "resources/js/app.tsx".to_owned(),
        }
    }

    pub fn with_paths(
        hot_file: impl Into<PathBuf>,
        manifest_path: impl Into<PathBuf>,
        entry: impl Into<String>,
    ) -> Self {
        Self {
            hot_file: hot_file.into(),
            manifest_path: manifest_path.into(),
            entry: entry.into(),
        }
    }

    pub fn version(&self) -> String {
        if self.hot_url().is_some() {
            return "dev".to_owned();
        }

        match fs::read(&self.manifest_path) {
            Ok(bytes) => format!("{:016x}", fnv1a_64(&bytes)),
            Err(_) => "1".to_owned(),
        }
    }

    pub fn tags(&self) -> String {
        if let Some(hot_url) = self.hot_url() {
            return format!(
                r#"<script type="module">
import RefreshRuntime from '{hot_url}/@react-refresh'
RefreshRuntime.injectIntoGlobalHook(window)
window.$RefreshReg$ = () => {{}}
window.$RefreshSig$ = () => (type) => type
window.__vite_plugin_react_preamble_installed__ = true
</script>
<script type="module" src="{hot_url}/@vite/client"></script>
<script type="module" src="{hot_url}/{entry}"></script>"#,
                entry = self.entry,
            );
        }

        let Ok(raw) = fs::read_to_string(&self.manifest_path) else {
            return String::new();
        };
        let Ok(manifest) = serde_json::from_str::<HashMap<String, ManifestEntry>>(&raw) else {
            return String::new();
        };

        let Some(entry_chunk) = manifest.get(&self.entry) else {
            return String::new();
        };

        let mut css_files = Vec::new();
        let mut seen_css = HashSet::new();
        let mut visited_keys = HashSet::new();
        collect_css(
            &manifest,
            &self.entry,
            &mut visited_keys,
            &mut seen_css,
            &mut css_files,
        );

        let mut tags = Vec::with_capacity(css_files.len() + 1);
        for css in css_files {
            tags.push(format!(r#"<link rel="stylesheet" href="/build/{css}">"#));
        }
        tags.push(format!(
            r#"<script type="module" src="/build/{file}"></script>"#,
            file = entry_chunk.file
        ));

        tags.join("\n    ")
    }

    fn hot_url(&self) -> Option<String> {
        let content = fs::read_to_string(&self.hot_file).ok()?;
        let trimmed = content.trim().trim_end_matches('/');
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_owned())
        }
    }
}

fn collect_css(
    manifest: &HashMap<String, ManifestEntry>,
    key: &str,
    visited: &mut HashSet<String>,
    seen_css: &mut HashSet<String>,
    out_css: &mut Vec<String>,
) {
    if !visited.insert(key.to_owned()) {
        return;
    }

    let Some(entry) = manifest.get(key) else {
        return;
    };

    for import in &entry.imports {
        collect_css(manifest, import, visited, seen_css, out_css);
    }

    for css in &entry.css {
        if seen_css.insert(css.clone()) {
            out_css.push(css.clone());
        }
    }
}

fn fnv1a_64(bytes: &[u8]) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for &byte in bytes {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
