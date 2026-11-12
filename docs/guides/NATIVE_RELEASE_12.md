# Native QA and release gates — v1.2

The available executor is Linux x86_64. macOS arm64/x64 and Windows x64 runtime,
installation, OS dialogs/permission failures, signing and notarization are NOT
verified. No DMG/EXE is claimed. macOS 13.0 remains the declared minimum, not a
tested compatibility guarantee; do not silently raise it. No release publishing.

## Gate 1: native runtime before QA packaging

On each actual target OS/CPU, install pinned npm dependencies with `npm ci` and
supply `build/metadata-runtime/<platform>-<arch>/` from reviewed reproducible
native build inputs. Unix layout: `bin/perl`, `lib/core`, `lib/arch`, licenses and
`manifest.json`; Windows: `exiftool.exe` plus its complete sibling runtime/DLL
layout, licenses and manifest. Include source/version/license and every file's
relative path/SHA-256. Never copy Linux binaries to Mac, rely on Homebrew or
system Perl, or add a skip-check environment variable. Review dynamic library
paths and the declared minimum OS for Perl, Electron and Sharp/libvips separately.
The Linux preparer pins Debian Perl 5.40.1. Mac/Windows preparation remains an
unresolved target-specific build task, not a script that pretends to have built it.

Run on the matching native host:

```sh
node scripts/check-metadata-native.cjs --target darwin-arm64 --root build/metadata-runtime/darwin-arm64 --report release/native-arm64.json
# repeat on actual darwin-x64 / win32-x64 / linux-x64 host with its matching root
```

The probe rejects a foreign host, unsafe/changed/unlisted manifest files; inspects
Unix linkage; executes actual JPEG/PNG/WebP read-write-read with an empty PATH,
checks protected payload/pixels and original hashes using the existing exporter.
Every `beforePack` invocation runs that fresh probe; a saved PASS report cannot
open the gate. `extraResources` selects the same target runtime. A valid probe
allows QA packaging only. No native Mac/Windows runtime has been supplied here,
so their gates remain closed. `--publish never` is mandatory, e.g.:

```sh
npm run dist:linux
npm run dist:mac -- --arm64
npm run dist:win
```

## Gate 2: installed application after packaging

Install/extract the produced package outside the checkout, into a test location
(e.g. Applications on Mac; an isolated NSIS install on Windows). Do not remove
Gatekeeper quarantine or bypass OS security decisions. Record package SHA-256,
actual OS/CPU/version, installer steps and installed executable path. Then run:

```sh
node scripts/check-installed-app.cjs --executable /absolute/installed/executable --report /absolute/qa/installed.json
```

This launches the real installed binary; GUI suites use new temporary user-data
folders, actual clipboard APIs, offline import/ZIP/generator, metadata write/read,
groups/reference/settings and restart. Dialog selections are automated fixtures,
not proof of real OS permission-denial or signing behavior. The report includes
binary hash, test commands and a full log. Keep real OS window activation,
Cmd/Ctrl shortcuts, permission-denied dialogs, unusual paths and uninstall/reinstall
checks as a separate target checklist; a Linux headless result cannot close them.

## Distribution gate (separate, not authorized here)

macOS: verify `codesign --verify --deep --strict`, inspect entitlements/nested
binaries, perform authorized notarization and stapling, and assess Gatekeeper on
both CPU targets. Windows: verify the real installer and Authenticode separately.
No certificates/credentials are available in this session; signing is BLOCKED.
Never put certificates, passwords, personal stores or generated test images in Git.
No PR merge, release upload, app publication or paid services were performed.
