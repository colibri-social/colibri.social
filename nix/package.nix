{
  lib,
  rustPlatform,
  runCommand,
  cef-binary,
  cmake,
  ninja,
  fetchPnpmDeps,
  cargo-tauri,
  glib-networking,
  nodejs_24,
  pnpm,
  pnpmConfigHook,
  openssl,
  pkg-config,
  webkitgtk_4_1,
  wrapGAppsHook3,
  makeDesktopItem,
  copyDesktopItems,
  gtk3,
  libsoup_3,
  glib,
  pipewire,
  libGL,
}:

let
  # nixpkgs cef-binary doesnt match the expected one by cef-dll-sys
  cef = cef-binary.override {
    version = "150.0.14";
    gitRevision = "7c1aa68";
    chromiumVersion = "150.0.7871.129";
    srcHashes.x86_64-linux = "sha256-QO9hPkVcrNB6p8gfQl76qLb3frg/E8wo1HDuuk5h+Y8=";
    srcHashes.aarch64-darwin = lib.fakeHash;
  };

  # cef-dll-sys assumes a flat layout (like from download-cef)
  # nix doesnt download it that way so we symlink this into the correct structure
  cefDir = runCommand "cef-dir-${cef.version}" { } ''
    mkdir -p $out/locales
    ln -s ${cef}/${cef.buildType}/* $out/
    for f in ${cef}/Resources/*; do
      [ "$(basename "$f")" = locales ] || ln -s "$f" $out/
    done
    ln -s ${cef}/Resources/locales/* $out/locales/
    ln -s ${cef}/include ${cef}/cmake ${cef}/libcef_dll \
          ${cef}/CMakeLists.txt ${cef}/CREDITS.html $out/
    echo '{"type": "minimal", "name": "cef_binary_${cef.version}", "sha1": ""}' > $out/archive.json
  '';
in
rustPlatform.buildRustPackage (finalAttrs: {
  pname = "colibri-social";
  version = (lib.importJSON ../packages/wrapper/src-tauri/tauri.conf.json).version;

  src = lib.cleanSource ../.;
  cargoRoot = "packages/wrapper/src-tauri";
  buildAndTestSubdir = finalAttrs.cargoRoot;

  # check phase runs cargo test which compiles everything a second time
  doCheck = false;

  cargoLock.lockFile = ../packages/wrapper/src-tauri/Cargo.lock;

  pnpmDeps = fetchPnpmDeps {
    inherit (finalAttrs) pname version src;
    fetcherVersion = 5;
    hash = "sha256-0Oh3ssd9pI145zSMyzAZUCPFvRGTneyEfwnfC50LXNI=";
  };

  nativeBuildInputs = [
    cargo-tauri.hook
    nodejs_24
    pnpm
    pnpmConfigHook
    pkg-config
    rustPlatform.bindgenHook
    # cef-dll-sys builds libcef_dll_wrapper with cmake + ninja
    cmake
    ninja
    wrapGAppsHook3
    copyDesktopItems
  ];

  # cmake in the inputs auto injects cmake stuff so we disable it
  dontUseCmakeConfigure = true;

  # build sandbox has no networking so we give it our own cef directory
  env.CEF_PATH = "${cefDir}";
  # the dev shell in nix/shell.nix uses the same directory
  passthru = { inherit cefDir; };

  buildInputs = [
    glib-networking
    openssl
    webkitgtk_4_1
    gtk3
    libsoup_3
    glib
    pipewire.dev
  ];

  # tauri hook assumes building a .deb bundle with hardcoded parts that break
  # and also bundles the cef version from nixpkgs. so we do our own build here
  buildPhase = ''
    runHook preBuild
    export CARGO_PROFILE_RELEASE_STRIP=false
    pushd ${finalAttrs.cargoRoot}
    cargo tauri build --no-bundle -- -j $NIX_BUILD_CORES --offline --no-default-features --features sentry
    popd
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    install -Dm755 ${finalAttrs.cargoRoot}/target/release/colibri-social $out/bin/colibri-social

    # copy over the runtime libraries from our cef install
    mkdir -p $out/lib/colibri-social
    for f in libcef.so libEGL.so libGLESv2.so libvk_swiftshader.so libvulkan.so.1 \
             vk_swiftshader_icd.json icudtl.dat v8_context_snapshot.bin \
             resources.pak chrome_100_percent.pak chrome_200_percent.pak locales; do
      cp -rL ${cefDir}/$f $out/lib/colibri-social/
    done

    # icons for desktop entry
    icons=${finalAttrs.cargoRoot}/icons
    for size in 32 64 128; do
      install -Dm644 $icons/''${size}x''${size}.png \
        $out/share/icons/hicolor/''${size}x''${size}/apps/colibri-social.png
    done
    install -Dm644 $icons/128x128@2x.png $out/share/icons/hicolor/256x256/apps/colibri-social.png
    install -Dm644 $icons/icon.png $out/share/icons/hicolor/512x512/apps/colibri-social.png
    runHook postInstall
  '';

  postFixup = ''
    # these libs are loaded by the bundled cef libraries at runtime so we need to add it to their rpath
    chmod -R u+w $out/lib/colibri-social
    patchelf --add-rpath ${
      lib.makeLibraryPath [
        libGL
      ]
    } \
      $out/lib/colibri-social/libGLESv2.so \
      $out/lib/colibri-social/libcef.so
  '';

  postPatch = ''
    rm ${finalAttrs.cargoRoot}/capabilities/updater.json
  '';

  desktopItems = [
    (makeDesktopItem {
      name = "colibri-social";
      desktopName = "Colibri Social";
      comment = "Next-generation social chat on the AT Protocol";
      exec = "colibri-social %u";
      icon = "colibri-social";
      startupWMClass = "colibri-social";
      categories = [
        "Network"
        "InstantMessaging"
        "Chat"
      ];
      mimeTypes = [
        "x-scheme-handler/social.colibri"
        "x-scheme-handler/social.colibri.spaces"
      ];
    })
  ];
})
