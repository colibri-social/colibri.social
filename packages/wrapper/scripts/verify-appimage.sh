#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
	echo "Usage: verify-appimage.sh <file.AppImage>" >&2
	exit 2
fi

appimage=$(realpath "$1")
workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT
cd "$workdir"

"$appimage" --appimage-extract > /dev/null

bundled=$(find squashfs-root \( -name 'libpipewire-0.3.so*' -o -name 'libspa-*' \) -print)
if [ -n "$bundled" ]; then
	echo "The AppImage bundles PipeWire libraries that must come from the host system:" >&2
	echo "$bundled" >&2
	exit 1
fi

stale=$(find squashfs-root -name 'libvpx.so*' -print)
if [ -n "$stale" ]; then
	echo "The AppImage bundles libvpx, which no Colibri binary links:" >&2
	echo "$stale" >&2
	exit 1
fi

echo "No PipeWire or libvpx libraries bundled in $(basename "$appimage")"
