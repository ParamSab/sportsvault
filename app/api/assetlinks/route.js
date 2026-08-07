// Android App Links (Digital Asset Links) — served at
// /.well-known/assetlinks.json via a rewrite in next.config.mjs. Lets Android
// open sportsvault.co.in links directly in the installed app.
//
// sha256_cert_fingerprints must list the SIGNING cert of the installed app:
//  - the upload key (below) covers internal/sideloaded installs
//  - once the app is on Play with Play App Signing, ALSO add Google's
//    app-signing SHA-256 (Play Console → Setup → App integrity) or App Links
//    verification will fail for Play-installed users.
const UPLOAD_KEY_SHA256 =
    'CE:26:E8:10:4D:93:CD:D1:BB:FD:D6:A5:22:74:3E:6B:B2:AD:2F:03:47:02:9E:81:8C:91:17:D6:B5:57:A3:60';

const ASSETLINKS = [
    {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
            namespace: 'android_app',
            package_name: 'com.paramsab.sportsvault',
            sha256_cert_fingerprints: [
                UPLOAD_KEY_SHA256,
                // TODO: add Google Play app-signing SHA-256 here after first upload.
            ],
        },
    },
];

export async function GET() {
    return Response.json(ASSETLINKS, {
        headers: { 'Cache-Control': 'public, max-age=3600' },
    });
}
