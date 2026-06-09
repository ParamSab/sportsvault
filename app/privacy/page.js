export const metadata = {
    title: 'Privacy Policy — SportsVault',
    description: 'How SportsVault collects, uses, and protects your personal information.',
};

export default function PrivacyPage() {
    return (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', fontFamily: 'sans-serif', color: '#e2e8f0', background: '#070b15', minHeight: '100vh' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 8 }}>Privacy Policy</h1>
            <p style={{ color: '#94a3b8', marginBottom: 40 }}>Last updated: June 2026</p>

            <Section title="1. Who we are">
                SportsVault is a social sports-coordination app that helps players find games, join teams, and build a sports reputation. References to "we", "us", or "SportsVault" mean the app and its operator.
            </Section>

            <Section title="2. Information we collect">
                <ul>
                    <li><strong>Phone number</strong> — used to verify your identity via one-time SMS codes (Twilio). We store the normalised E.164 number.</li>
                    <li><strong>Display name & profile photo</strong> — chosen by you during onboarding.</li>
                    <li><strong>Location</strong> — the city or neighbourhood you enter, and optionally precise GPS coordinates used to show nearby games. We never share precise coordinates with other users.</li>
                    <li><strong>Sports preferences</strong> — which sports you play and your preferred position.</li>
                    <li><strong>Game activity</strong> — games you create or join, RSVPs, match results, and peer ratings.</li>
                    <li><strong>Email address</strong> — optional, used only as a login credential if you choose to set a password.</li>
                </ul>
            </Section>

            <Section title="3. How we use your information">
                <ul>
                    <li>Authenticate you via SMS OTP or password.</li>
                    <li>Show you upcoming games near your location.</li>
                    <li>Display your profile and game history to other players in the app.</li>
                    <li>Send game reminders via SMS (only for games you RSVP'd to).</li>
                    <li>Calculate your Trust Score and sports ratings.</li>
                </ul>
            </Section>

            <Section title="4. Third-party services">
                <ul>
                    <li><strong>Twilio Verify</strong> — processes your phone number to deliver OTP codes. See <a href="https://www.twilio.com/legal/privacy" style={{ color: '#6366f1' }} target="_blank" rel="noopener noreferrer">Twilio's Privacy Policy</a>.</li>
                    <li><strong>Supabase / PostgreSQL</strong> — stores your account and game data in a secure cloud database.</li>
                    <li><strong>Nominatim / OpenStreetMap</strong> — reverse-geocodes GPS coordinates to a human-readable locality name. No account data is sent.</li>
                </ul>
            </Section>

            <Section title="5. Data retention">
                We retain your data for as long as your account is active. You may delete your account at any time from the Profile screen. On deletion, your user record, RSVPs, notifications, and ratings are permanently removed.
            </Section>

            <Section title="6. Your rights">
                You have the right to access, correct, or erase your personal data. To make a request, email us or use the in-app "Delete my account" button in your Profile.
            </Section>

            <Section title="7. Security">
                Passwords are stored as bcrypt hashes. Session tokens are encrypted with iron-session. We use HTTPS for all data in transit.
            </Section>

            <Section title="8. Children">
                SportsVault is not directed at children under 13. We do not knowingly collect data from children under 13.
            </Section>

            <Section title="9. Changes">
                We may update this policy. Continued use of the app after changes constitutes acceptance of the revised policy.
            </Section>

            <Section title="10. Contact">
                Questions? Email us at <a href="mailto:support@sportsvault.app" style={{ color: '#6366f1' }}>support@sportsvault.app</a>
            </Section>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 12 }}>{title}</h2>
            <div style={{ color: '#cbd5e1', lineHeight: 1.75, fontSize: '0.9375rem' }}>{children}</div>
        </div>
    );
}
