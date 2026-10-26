#!/bin/bash
set -euo pipefail
mkdir -p dist
exec > >(tee dist/cloud-build.log) 2>&1
trap 's=$?; echo "cloud-build exit=$s"; exit "$s"' EXIT
sw_vers
xcodebuild -version
xcrun --sdk iphoneos --show-sdk-version
node tests/core.test.cjs
find extension -name '*.js' -exec node --check {} \;
# Keep the exact converter capability output with the deliverables.
xcrun safari-web-extension-converter --help 2>&1 | tee dist/converter-help.txt
grep -q -- '--ios' dist/converter-help.txt
xcrun safari-web-extension-converter "$PWD/extension" \
  --project-location "$PWD/generated" --app-name ScriptStudio \
  --bundle-identifier com.local.scriptstudio --swift --ios --no-open --no-prompt 2>&1 | tee dist/converter.log
PROJECT=$(find generated -name '*.xcodeproj' -type d | head -1)
test -n "$PROJECT"
xcodebuild -list -json -project "$PROJECT" > dist/xcode-project.json
SCHEME=$(python3 - <<'PY'
import json
j=json.load(open('dist/xcode-project.json'))['project']['schemes']
a=[s for s in j if 'ios' in s.lower() and 'extension' not in s.lower()]
if not a: a=[s for s in j if 'extension' not in s.lower() and 'macos' not in s.lower()]
assert a, j
print(a[0])
PY
)
echo "Project=$PROJECT Scheme=$SCHEME"
set +e
xcodebuild -project "$PROJECT" -scheme "$SCHEME" -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' \
  -archivePath "$PWD/dist/ScriptStudio.xcarchive" \
  -derivedDataPath "$PWD/DerivedData" archive \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' \
  IPHONEOS_DEPLOYMENT_TARGET=15.0 TARGETED_DEVICE_FAMILY='1,2' \
  2>&1 | tee dist/xcodebuild.log
BUILD_STATUS=${PIPESTATUS[0]}
set -e
echo "$BUILD_STATUS" > dist/xcodebuild-exit-code.txt
test "$BUILD_STATUS" = 0
APP=$(find dist/ScriptStudio.xcarchive/Products/Applications -maxdepth 1 -name '*.app' -type d | head -1)
test -n "$APP"
export APP
python3 - <<'PY' | tee dist/archive-validation.txt
import os,plistlib,pathlib,subprocess,json
app=pathlib.Path(os.environ['APP'])
bundles=[app]+list((app/'PlugIns').glob('*.appex'))
assert len(bundles)>1, 'Missing embedded extension'
for p in bundles:
 info=plistlib.load(open(p/'Info.plist','rb'))
 print('\nBUNDLE',p)
 print(json.dumps(info,ensure_ascii=False,indent=2,default=str))
 exe=p/info['CFBundleExecutable']
 subprocess.run(['file',str(exe)],check=True)
 subprocess.run(['xcrun','lipo','-info',str(exe)],check=True)
 subprocess.run(['xcrun','vtool','-show-build',str(exe)],check=True)
 assert 'arm64' in subprocess.check_output(['xcrun','lipo','-archs',str(exe)],text=True)
 assert float(info['MinimumOSVersion'])<=15.0
 if p.suffix=='.appex':
  assert info['NSExtension']['NSExtensionPointIdentifier']=='com.apple.Safari.web-extension'
  assert list(p.rglob('manifest.json')), 'Extension manifest not copied'
PY
# Ensure the unsigned IPA has no bundle signatures; package the complete embedded appex.
for BUNDLE in "$APP"/PlugIns/*.appex "$APP"; do
  codesign --remove-signature "$BUNDLE" 2>/dev/null || true
done
mkdir -p dist/unsigned/Payload
cp -R "$APP" dist/unsigned/Payload/
(cd dist/unsigned && /usr/bin/zip -qry ../ScriptStudio-unsigned.ipa Payload)
# Apple tool ad-hoc signature (Signature=adhoc): no identity, certificate or provisioning profile.
mkdir -p dist/adhoc/Payload
cp -R "$APP" dist/adhoc/Payload/
SIGNED_APP=$(find dist/adhoc/Payload -maxdepth 1 -name '*.app' -type d | head -1)
for BUNDLE in "$SIGNED_APP"/PlugIns/*.appex "$SIGNED_APP"; do
  codesign --force --sign - --timestamp=none "$BUNDLE"
  codesign --verify --strict --verbose=2 "$BUNDLE" 2>&1 | tee -a dist/adhoc-signature-verification.txt
  codesign -dvv "$BUNDLE" 2>&1 | tee -a dist/adhoc-signature-verification.txt
done
(cd dist/adhoc && /usr/bin/zip -qry ../ScriptStudio-adhoc.ipa Payload)
cat > dist/INSTALL-LIMITS.txt <<'EOF'
ScriptStudio: experimental Safari WebExtension, Manifest V2.
unsigned IPA: no Apple development/distribution signature or provisioning profile.
adhoc IPA: codesign --sign -; ad-hoc local signature only, NOT Apple developer signing and NOT ad-hoc provisioning distribution.
Normal iOS installation is not guaranteed. Requires a compatible jailbreak installation/trust mechanism; no device connection, install, app registration, or Safari registration was performed.
Target: iOS 15.0+, arm64. Historical device iOS17 rootHide/relaxin NOT re-probed.
Do not blindly copy to /var/jb or fabricate a rootHide deb install path.
Safari enablement, website permissions, MV2 CSP unsafe-eval and dynamic script execution remain unverified on-device.
EOF
# Include original source plus converter-generated Xcode project, excluding build products.
tar -czf dist/ScriptStudio-source-and-xcode-project.tar.gz README.md extension tests bundled-scripts.json cloud-build.sh cloud-workflow.yml generated
(cd dist && shasum -a 256 *.ipa *.tar.gz > SHA256SUMS)
# Keep archive as a portable zip instead of thousands of individual artifact entries.
(cd dist && /usr/bin/ditto -c -k --sequesterRsrc --keepParent ScriptStudio.xcarchive ScriptStudio-unsigned.xcarchive.zip)
rm -rf dist/unsigned dist/adhoc dist/ScriptStudio.xcarchive
ls -lh dist
