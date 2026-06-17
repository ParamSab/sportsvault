export const metadata = {
  title: 'Support — SportsVault',
  description: 'Get help with SportsVault.',
};

export default function SupportPage() {
  return (
    <main className="container" style={{ maxWidth: 680, padding: '40px 20px 80px', lineHeight: 1.7 }}>
      <h1 style={{ marginBottom: 8 }}>Support</h1>
      <p className="text-muted text-sm" style={{ marginBottom: 28 }}>We&apos;re here to help.</p>

      <h2 style={{ margin: '24px 0 10px' }}>Contact us</h2>
      <p style={{ marginBottom: 20 }}>
        Email <a href="mailto:paramsabnani@gmail.com" style={{ color: '#818cf8' }}>paramsabnani@gmail.com</a> and
        we&apos;ll get back to you. Include your account phone/email and a description of the issue.
      </p>

      <h2 style={{ margin: '24px 0 10px' }}>Common questions</h2>
      <ul style={{ paddingLeft: 20, marginBottom: 20, listStyle: 'disc' }}>
        <li><strong>Didn&apos;t get your code?</strong> Check your signal and that the number includes the country code, then request a new code.</li>
        <li><strong>Can&apos;t see games nearby?</strong> Allow location access in Settings, or change your city in your profile.</li>
        <li><strong>Want to delete your account?</strong> Email us from your registered address and we&apos;ll remove your data.</li>
      </ul>

      <p className="text-muted text-sm" style={{ marginTop: 32 }}>
        <a href="/" style={{ color: '#818cf8' }}>← Back to SportsVault</a>
      </p>
    </main>
  );
}
