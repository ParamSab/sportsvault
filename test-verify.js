async function testVerify() {
    console.log("Testing verify...");
    try {
        const res = await fetch('http://localhost:3000/api/auth/phone/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: '+919999999999', code: '990770', rememberMe: true })
        });
        const text = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`Response: ${text}`);
    } catch (e) {
        console.error("Fetch threw an error:", e.message);
    }
}
testVerify();
