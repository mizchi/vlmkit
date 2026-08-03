{ pkgs, version ? "0.27.0" }:

let
  inherit (pkgs) lib stdenv fetchurl autoPatchelfHook makeWrapper;
  system = stdenv.hostPlatform.system;

  sources = {
    "x86_64-linux" = {
      suffix = "linux-x86_64";
      sha256 = "be2d8a97ca8816636117ec26da85482d647ae3353213ea022fb1130c2dd3d3b0";
    };
    "aarch64-linux" = {
      suffix = "linux-arm64";
      sha256 = "7df6e64ca9540665367f07af0226077ba92820f6cc759c10a5ca37e038a500e4";
    };
    "x86_64-darwin" = {
      suffix = "darwin-x86_64";
      sha256 = "846b30055d96cbc6fa0fcf451f50d13f632b540ffdff344873a025bba607e25a";
    };
    "aarch64-darwin" = {
      suffix = "darwin-arm64";
      sha256 = "4c68e5eaa3cfdb0b25734c316deb532835eaf3c3e2f7379a4c7c06918043a641";
    };
  };

  srcInfo = sources.${system} or (throw "apm.nix: unsupported system ${system}");
in
stdenv.mkDerivation {
  pname = "apm";
  inherit version;

  src = fetchurl {
    url = "https://github.com/microsoft/apm/releases/download/v${version}/apm-${srcInfo.suffix}.tar.gz";
    sha256 = srcInfo.sha256;
  };

  sourceRoot = "apm-${srcInfo.suffix}";

  nativeBuildInputs = [ makeWrapper ]
    ++ lib.optionals stdenv.isLinux [ autoPatchelfHook ];

  buildInputs = lib.optionals stdenv.isLinux [
    stdenv.cc.cc.lib
    pkgs.zlib
  ];

  dontConfigure = true;
  dontBuild = true;
  # PyInstaller appends its PKG archive after the Mach-O / ELF binary.
  # strip / patchelf would truncate or corrupt that archive.
  dontStrip = true;
  dontPatchELF = true;

  installPhase = ''
    runHook preInstall
    mkdir -p $out/libexec/apm $out/bin
    cp -r . $out/libexec/apm/
    chmod +x $out/libexec/apm/apm
    makeWrapper $out/libexec/apm/apm $out/bin/apm
    runHook postInstall
  '';

  meta = with lib; {
    description = "Agent Package Manager (microsoft/apm) — dependency manager for AI agent configuration";
    homepage = "https://github.com/microsoft/apm";
    license = licenses.mit;
    mainProgram = "apm";
    platforms = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
    sourceProvenance = [ sourceTypes.binaryNativeCode ];
  };
}
