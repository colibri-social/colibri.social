fn xcode_clang() -> Option<std::path::PathBuf> {
    let output = std::process::Command::new("xcrun")
        .args(["-f", "clang"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let path = String::from_utf8(output.stdout).ok()?;
    let path = path.trim();
    if path.is_empty() {
        None
    } else {
        Some(std::path::PathBuf::from(path))
    }
}

fn main() {
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    if target_os == "macos" || target_os == "ios" {
        let mut build = cc::Build::new();
        if let Some(clang) = xcode_clang() {
            build.compiler(clang);
        }
        build
            .file("src/web_auth.m")
            .flag("-fobjc-arc")
            .compile("colibri_web_auth");
        println!("cargo:rustc-link-lib=framework=AuthenticationServices");
        if target_os == "ios" {
            println!("cargo:rustc-link-lib=framework=UIKit");
        } else {
            println!("cargo:rustc-link-lib=framework=AppKit");
        }
        println!("cargo:rerun-if-changed=src/web_auth.m");
    }
    tauri_build::build()
}
