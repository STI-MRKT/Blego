#!/bin/bash
# Native Mac-only build input for BLEGO's bundled metadata interpreter.
set -euo pipefail
[ "$(uname -s)" = "Darwin" ] || { echo "Darwin required" >&2; exit 2; }
case "$(uname -m)" in arm64) arch=arm64;; x86_64) arch=x64;; *) exit 2;; esac
repo="$(cd "$(dirname "$0")/.." && pwd)"
root="$repo/build/metadata-runtime/darwin-$arch"
if [ -f "$root/manifest.json" ]; then
  node "$repo/scripts/make-runtime-manifest.cjs" "$root" "darwin-$arch" --verify
  exit 0
fi
[ ! -e "$root" ] || { echo "Incomplete runtime exists; inspect before retrying" >&2; exit 3; }
command -v clang >/dev/null && command -v make >/dev/null && command -v curl >/dev/null
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
curl --fail --location --retry 3 --connect-timeout 20 --max-time 240   https://www.cpan.org/src/5.0/perl-5.40.1.tar.gz -o "$work/perl.tar.gz"
echo "02f8c45bb379ed0c3de7514fad48c714fd46be8f0b536bfd5320050165a1ee26  $work/perl.tar.gz" | shasum -a 256 -c -
tar -xzf "$work/perl.tar.gz" -C "$work"
install="$work/install"
cd "$work/perl-5.40.1"
sh Configure -des -Dprefix="$install" -Dprivlib="$install/lib/core"   -Darchlib="$install/lib/arch" -Uuseshrplib -Dcc=clang -Dld=clang   -Dman1dir=none -Dman3dir=none
make -j2
make install
[ -f "$install/bin/perl" ] && [ -d "$install/lib/core" ] && [ -d "$install/lib/arch" ] || exit 4
"$install/bin/perl" -e 'die "Unexpected Perl version\n" unless "$^V" eq "v5.40.1"'
staged="$work/runtime"
mkdir -p "$staged/bin" "$staged/lib/core" "$staged/lib/arch" "$staged/licenses"
cp -L "$install/bin/perl" "$staged/bin/perl"
chmod 755 "$staged/bin/perl"
cp -RL "$install/lib/core/." "$staged/lib/core/"
cp -RL "$install/lib/arch/." "$staged/lib/arch/"
cp -L "$work/perl-5.40.1/Artistic" "$staged/licenses/Artistic.txt"
cp -L "$work/perl-5.40.1/Copying" "$staged/licenses/Copying.txt"
otool -L "$staged/bin/perl" > "$work/dylibs.txt"
if grep -E '/opt/homebrew/|/usr/local/|/Users/runner/|/private/var/folders/' "$work/dylibs.txt"; then
  echo "Unbundled build-host dependency detected" >&2; exit 5
fi
node "$repo/scripts/make-runtime-manifest.cjs" "$staged" "darwin-$arch"
mkdir -p "$(dirname "$root")"
mv "$staged" "$root"
echo "Prepared native Perl: $root"
