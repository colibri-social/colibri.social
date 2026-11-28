{
  lib,
  stdenv,
  mkShell,
  nodejs_24,
  pnpm,
  git,
  python3,
  clippy,
  rustfmt,
  cargo-tauri,
  desktop-file-utils,
  libGL,
  xz,
  # the package from ./package.nix
  package,
}:

mkShell (
{
  inputsFrom = [ package ];

  packages = [
    nodejs_24
    # the pnpm version from nixpkgs will, on first run, install the correct version from package.json
    # into the pnpm home directory
    pnpm
    git
    python3
    clippy
    rustfmt
    cargo-tauri
    desktop-file-utils
  ];

  CEF_PATH = package.cefDir;
}
// lib.optionalAttrs stdenv.hostPlatform.isLinux {
  LD_LIBRARY_PATH =
    lib.makeLibraryPath [
      stdenv.cc.cc.lib
      xz
      libGL
    ]
    + ":/run/opengl-driver/lib";
}
)
