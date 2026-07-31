// Apple App Site Association — served at /.well-known/apple-app-site-association
// via a rewrite in next.config.mjs. Lets iOS open sportsvault.co.in links
// directly in the installed app (Universal Links).
const AASA = {
    applinks: {
        apps: [],
        details: [
            {
                appIDs: ['K859Z8R2HR.com.paramsab.sportsvault'],
                components: [{ '/': '*' }],
            },
        ],
    },
};

export async function GET() {
    return Response.json(AASA, {
        headers: { 'Cache-Control': 'public, max-age=3600' },
    });
}
