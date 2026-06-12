export const metadata = {
    title: 'Terms of Use — SportsVault',
    description: 'Rules and conditions for using the SportsVault app.',
};

export default function TermsPage() {
    return (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', fontFamily: 'sans-serif', color: '#e2e8f0', background: '#070b15', minHeight: '100vh' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 8 }}>Terms of Use</h1>
            <p style={{ color: '#94a3b8', marginBottom: 40 }}>Last updated: June 2026</p>

            <Section title="1. Acceptance">
                By creating an account or using SportsVault, you agree to these terms. If you do not agree, do not use the app.
            </Section>

            <Section title="2. Eligibility">
                You must be at least 13 years old to use SportsVault. By registering you confirm you meet this requirement.
            </Section>

            <Section title="3. Your account">
                You are responsible for keeping your phone number and password secure. You may not share your account or impersonate another person.
            </Section>

            <Section title="4. Acceptable use">
                You agree not to:
                <ul>
                    <li>Post false, misleading, or harmful content.</li>
                    <li>Harass, abuse, or threaten other players.</li>
                    <li>Create fake games or deliberately no-show without cancelling.</li>
                    <li>Use the app to spam or send unsolicited messages.</li>
                    <li>Reverse-engineer, scrape, or abuse the platform's APIs.</li>
                </ul>
            </Section>

            <Section title="5. Game conduct">
                SportsVault facilitates meeting between players but is not responsible for what happens at physical games. Attend safely and respect local laws, venue rules, and other players.
            </Section>

            <Section title="6. Ratings & Trust Score">
                Player ratings and Trust Scores are community-generated. We reserve the right to remove ratings that violate our conduct standards.
            </Section>

            <Section title="7. Content">
                You grant SportsVault a non-exclusive licence to display your profile photo and game information within the app. You retain ownership of your content.
            </Section>

            <Section title="8. User-generated content & moderation">
                There is zero tolerance for objectionable content or abusive behaviour on SportsVault. Comments ("thoughts"), ratings, and profiles are user-generated. You can:
                <ul>
                    <li><strong>Report</strong> any comment using the ⚑ Report button — we review all reports and remove violating content within 24 hours.</li>
                    <li><strong>Remove</strong> any comment left on your own profile at any time.</li>
                    <li><strong>Block</strong> any user from their profile — blocked users' content is hidden from you and they cannot interact with you.</li>
                </ul>
                Users who post objectionable content or harass others will have their content removed and may be permanently banned.
            </Section>

            <Section title="9. Termination">
                We may suspend or delete accounts that violate these terms. You may delete your account at any time from the Profile screen.
            </Section>

            <Section title="10. Disclaimers">
                SportsVault is provided "as is". We do not guarantee uptime, the accuracy of player information, or the safety of any game organised through the platform.
            </Section>

            <Section title="11. Limitation of liability">
                To the maximum extent permitted by law, SportsVault is not liable for any indirect, incidental, or consequential damages arising from your use of the app.
            </Section>

            <Section title="12. Governing law">
                These terms are governed by the laws of India.
            </Section>

            <Section title="13. Contact">
                Questions? Email <a href="mailto:support@sportsvault.app" style={{ color: '#c6f432' }}>support@sportsvault.app</a>
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
