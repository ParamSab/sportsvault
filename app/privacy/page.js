export const metadata = {
  title: 'Privacy Policy — SportsVault',
  description: 'How SportsVault collects, uses, and protects your data.',
};

const UPDATED = 'June 17, 2026';

export default function PrivacyPage() {
  return (
    <main className="container" style={{ maxWidth: 760, padding: '40px 20px 80px', lineHeight: 1.7 }}>
      <h1 style={{ marginBottom: 8 }}>Privacy Policy</h1>
      <p className="text-muted text-sm" style={{ marginBottom: 28 }}>Last updated: {UPDATED}</p>

      <p style={{ marginBottom: 20 }}>
        SportsVault (&quot;we&quot;, &quot;us&quot;) helps you find local sports games, connect with
        players, and build a sporting reputation. This policy explains what we collect and why.
      </p>

      <h2 style={{ margin: '28px 0 10px' }}>Information we collect</h2>
      <ul style={{ paddingLeft: 20, marginBottom: 20, listStyle: 'disc' }}>
        <li><strong>Account &amp; contact:</strong> phone number and/or email, used to sign you in via a one-time code, and your display name.</li>
        <li><strong>Profile:</strong> sports, positions, location/city, and an optional profile photo you choose to upload.</li>
        <li><strong>Location:</strong> approximate or precise device location, only when you grant permission, to show games and venues near you.</li>
        <li><strong>Photos:</strong> images you choose for your profile or a game booking receipt. We access your photos/camera only when you initiate an upload.</li>
        <li><strong>Activity:</strong> games you create or join, RSVPs, ratings, and friend connections.</li>
      </ul>

      <h2 style={{ margin: '28px 0 10px' }}>How we use it</h2>
      <ul style={{ paddingLeft: 20, marginBottom: 20, listStyle: 'disc' }}>
        <li>Authenticate you and keep you signed in.</li>
        <li>Show nearby games, players, and venues; enable RSVPs and team balancing.</li>
        <li>Send game reminders and notifications you opt into.</li>
        <li>Maintain your sporting reputation (ratings, trust score) and history.</li>
      </ul>

      <h2 style={{ margin: '28px 0 10px' }}>Service providers</h2>
      <p style={{ marginBottom: 20 }}>
        We use trusted processors to run the service: <strong>Supabase</strong> (database/hosting),
        <strong> Twilio</strong> (SMS verification codes), <strong>Resend</strong> (email codes), and
        <strong> Vercel</strong> (application hosting). They process data only to provide these features.
      </p>

      <h2 style={{ margin: '28px 0 10px' }}>Sharing</h2>
      <p style={{ marginBottom: 20 }}>
        We do not sell your personal data. Profile details (name, photo, sports, ratings) are visible to
        other players as part of the social features. Location is used on-device to surface nearby games and
        is not shared with other users at precise resolution.
      </p>

      <h2 style={{ margin: '28px 0 10px' }}>Your choices</h2>
      <ul style={{ paddingLeft: 20, marginBottom: 20, listStyle: 'disc' }}>
        <li>Revoke location, camera, photo, or notification permissions any time in your device settings.</li>
        <li>Edit or remove profile information in the app.</li>
        <li>Request deletion of your account and associated data (see Contact below).</li>
      </ul>

      <h2 style={{ margin: '28px 0 10px' }}>Data retention &amp; security</h2>
      <p style={{ marginBottom: 20 }}>
        We keep your data while your account is active and delete it on request. Data is transmitted over
        HTTPS/TLS and stored with our hosting providers&apos; standard protections.
      </p>

      <h2 style={{ margin: '28px 0 10px' }}>Children</h2>
      <p style={{ marginBottom: 20 }}>SportsVault is not directed to children under 13.</p>

      <h2 style={{ margin: '28px 0 10px' }}>Contact</h2>
      <p style={{ marginBottom: 20 }}>
        Questions or data requests: <a href="mailto:paramsabnani@gmail.com" style={{ color: '#818cf8' }}>paramsabnani@gmail.com</a>.
      </p>

      <p className="text-muted text-sm" style={{ marginTop: 32 }}>
        <a href="/" style={{ color: '#818cf8' }}>← Back to SportsVault</a>
      </p>
    </main>
  );
}
