'use client';

export default function PaymentPage({ game, myRsvp, currentUserId, onClose, onMarkPaid }) {
    const fee = game?.price || 0;
    const upiId = game?.upiId || '';
    const organizerName = game?.organizer?.name || 'Organizer';
    const payStatus = myRsvp?.paymentStatus || 'not_required';

    const upiLink = upiId
        ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(organizerName)}&am=${fee}&cu=INR&tn=${encodeURIComponent('SportsVault: ' + game.title)}`
        : null;

    const handleOpenUPI = () => {
        if (upiLink) {
            window.location.href = upiLink;
        }
    };

    const statusLabel = {
        not_required: null,
        pending: { text: '⏳ Payment Pending Approval', color: '#f59e0b' },
        approved: { text: '✅ Payment Confirmed', color: '#22c55e' },
    }[payStatus];

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{
                background: 'var(--bg-card)',
                borderRadius: '24px 24px 0 0',
                padding: '28px 24px 40px',
                width: '100%',
                maxWidth: 480,
                boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
            }}>
                {/* Handle bar */}
                <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-color)', margin: '0 auto 24px' }} />

                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>💳</div>
                    <h2 style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: 4 }}>Pay Entry Fee</h2>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{game.title}</div>
                </div>

                {/* Amount */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.08))',
                    border: '1px solid rgba(99,102,241,0.25)',
                    borderRadius: 16,
                    padding: '20px 24px',
                    textAlign: 'center',
                    marginBottom: 20,
                }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Amount Due</div>
                    <div style={{ fontSize: '3rem', fontWeight: 900, color: '#6366f1', lineHeight: 1 }}>₹{fee}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 8 }}>to {organizerName}</div>
                </div>

                {statusLabel ? (
                    <div style={{
                        padding: '14px 20px',
                        borderRadius: 12,
                        background: payStatus === 'approved' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                        border: `1px solid ${payStatus === 'approved' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
                        textAlign: 'center',
                        fontWeight: 700,
                        color: statusLabel.color,
                        marginBottom: 16,
                    }}>
                        {statusLabel.text}
                    </div>
                ) : null}

                {payStatus !== 'approved' && upiId && (
                    <>
                        {/* UPI ID display */}
                        <div style={{
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 10,
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 16,
                        }}>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>UPI ID</div>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginTop: 2 }}>{upiId}</div>
                            </div>
                            <button
                                className="btn btn-xs btn-outline"
                                onClick={() => { navigator.clipboard?.writeText(upiId); }}
                                style={{ fontSize: '0.7rem' }}
                            >
                                Copy
                            </button>
                        </div>

                        {/* Open UPI app */}
                        <button
                            className="btn btn-primary btn-block"
                            style={{ marginBottom: 12, fontSize: '1rem', padding: '14px', borderRadius: 14, fontWeight: 700 }}
                            onClick={handleOpenUPI}
                        >
                            Pay ₹{fee} via GPay / UPI →
                        </button>

                        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                            Opens GPay, PhonePe, Paytm or any UPI app with amount pre-filled
                        </div>
                    </>
                )}

                {payStatus === 'not_required' && upiId && (
                    <button
                        className="btn btn-outline btn-block"
                        style={{ borderRadius: 14, fontWeight: 600, padding: '13px' }}
                        onClick={onMarkPaid}
                    >
                        ✓ I've Paid — Notify Organizer
                    </button>
                )}

                {payStatus === 'pending' && (
                    <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Waiting for the organizer to confirm your payment.
                    </div>
                )}

                {payStatus === 'approved' && (
                    <button className="btn btn-primary btn-block" style={{ borderRadius: 14 }} onClick={onClose}>
                        Done
                    </button>
                )}
            </div>
        </div>
    );
}
