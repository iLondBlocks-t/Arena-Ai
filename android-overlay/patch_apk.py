#!/usr/bin/env python3
"""Apply the repository's WebView overlay to a Median/GoNative APK.

The result is intentionally UNSIGNED. Rewriting any APK invalidates its
signature; it must be signed with the original release key to be an in-place
upgrade. No private key is present in this repository.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
CONFIG = 'assets/appConfig.json'
CSS = 'assets/customCSS.css'
JS = 'assets/customJS.js'


def patched_config(raw: bytes) -> bytes:
    config = json.loads(raw.decode('utf-8'))
    general = config.setdefault('general', {})
    styling = config.setdefault('styling', {})
    splash = styling.setdefault('splashScreen', {}).setdefault('android', {})

    # The supplied APK already launches Arena at its configured URL; preserve
    # that exact URL and all auth/network settings while skipping wrapper splash.
    if not general.get('initialUrl', '').startswith(('https://', 'http://')):
        raise ValueError('Expected a configured HTTP(S) initialUrl; refusing to alter launch routing.')
    splash['showSplash'] = False
    styling['androidShowLogoInSideBar'] = False
    styling['androidShowAppNameInSideBar'] = False
    return (json.dumps(config, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def patch(source: Path, destination: Path) -> None:
    if source.resolve() == destination.resolve():
        raise ValueError('Input and output must differ; the original signed APK is never overwritten.')
    if destination.exists():
        raise FileExistsError(f'Refusing to overwrite {destination}')
    if not zipfile.is_zipfile(source):
        raise ValueError(f'{source} is not a readable APK/ZIP archive')

    css = (ROOT / 'customCSS.css').read_bytes()
    js = (ROOT / 'customJS.js').read_bytes()
    destination.parent.mkdir(parents=True, exist_ok=True)

    # ZipFile rewrites the archive and removes the APK Signing Block. Strip
    # legacy v1 signature files too: this output must not be mistaken as signed.
    with zipfile.ZipFile(source, 'r') as zin:
        names = set(zin.namelist())
        missing = {CONFIG, CSS, JS} - names
        if missing:
            raise ValueError('APK is not the expected Median/GoNative package; missing: ' + ', '.join(sorted(missing)))
        config = patched_config(zin.read(CONFIG))
        try:
            with zipfile.ZipFile(destination, 'w') as zout:
                zout.comment = zin.comment
                for info in zin.infolist():
                    name = info.filename
                    upper = name.upper()
                    if upper.startswith('META-INF/') and upper.endswith(('.RSA', '.DSA', '.EC', '.SF')):
                        continue
                    if upper == 'META-INF/MANIFEST.MF':
                        continue
                    if name == CONFIG:
                        data = config
                    elif name == CSS:
                        data = css
                    elif name == JS:
                        data = js
                    else:
                        data = zin.read(name)
                    zout.writestr(info, data)
        except Exception:
            destination.unlink(missing_ok=True)
            raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input_apk', type=Path)
    parser.add_argument('output_unsigned_apk', type=Path, help='Must be a new path; output is NOT installable until properly signed.')
    args = parser.parse_args()
    patch(args.input_apk, args.output_unsigned_apk)
    print(f'Wrote unsigned patched APK: {args.output_unsigned_apk}')
    print('Do not install or distribute this file until it is aligned and signed with the original app signing key.')


if __name__ == '__main__':
    main()
