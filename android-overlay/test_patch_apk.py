import json
from pathlib import Path
import tempfile
import unittest
import zipfile

from patch_apk import CONFIG, CSS, JS, patch, patched_config


class PatchTests(unittest.TestCase):
    def test_config_skips_android_splash_without_changing_ai_url(self):
        original = {
            'general': {'initialUrl': 'https://arena.ai/', 'androidUserAgentAdd': 'median'},
            'styling': {
                'androidShowLogoInSideBar': True,
                'androidShowAppNameInSideBar': True,
                'splashScreen': {'android': {'showSplash': True}},
            },
            'navigation': {'tabNavigation': {'active': False}},
        }
        result = json.loads(patched_config(json.dumps(original).encode()))
        self.assertEqual(result['general'], original['general'])
        self.assertFalse(result['styling']['splashScreen']['android']['showSplash'])
        self.assertFalse(result['styling']['androidShowLogoInSideBar'])
        self.assertFalse(result['styling']['androidShowAppNameInSideBar'])
        self.assertEqual(result['navigation'], original['navigation'])

    def test_rejects_non_web_startup_route(self):
        with self.assertRaises(ValueError):
            patched_config(b'{"general":{"initialUrl":""}}')

    def test_patches_assets_and_removes_v1_signature(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            source, output = tmp / 'input.apk', tmp / 'output-unsigned.apk'
            with zipfile.ZipFile(source, 'w') as archive:
                archive.writestr(CONFIG, json.dumps({
                    'general': {'initialUrl': 'https://arena.ai/'},
                    'styling': {'splashScreen': {'android': {'showSplash': True}}},
                }))
                archive.writestr(CSS, 'old css')
                archive.writestr(JS, 'old js')
                archive.writestr('META-INF/CERT.SF', 'signature')
                archive.writestr('assets/keep.txt', 'untouched')
            patch(source, output)
            with zipfile.ZipFile(output) as archive:
                self.assertIn('assets/keep.txt', archive.namelist())
                self.assertNotIn('META-INF/CERT.SF', archive.namelist())
                self.assertEqual(archive.read(CSS), (Path(__file__).parent / 'customCSS.css').read_bytes())
                self.assertEqual(archive.read(JS), (Path(__file__).parent / 'customJS.js').read_bytes())
                config = json.loads(archive.read(CONFIG))
                self.assertFalse(config['styling']['splashScreen']['android']['showSplash'])

    def test_never_overwrites_input_or_existing_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / 'input.apk'
            with zipfile.ZipFile(source, 'w') as archive:
                archive.writestr(CONFIG, '{"general":{"initialUrl":"https://arena.ai/"}}')
                archive.writestr(CSS, '')
                archive.writestr(JS, '')
            with self.assertRaises(ValueError):
                patch(source, source)
            output = Path(tmp) / 'exists.apk'
            output.write_bytes(b'keep')
            with self.assertRaises(FileExistsError):
                patch(source, output)
            self.assertEqual(output.read_bytes(), b'keep')


if __name__ == '__main__':
    unittest.main()
