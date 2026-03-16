const fs = require('fs');

const otpRoutePath = 'c:\\Users\\Param\\Downloads\\New folder\\sportsvault\\app\\api\\auth\\otp\\send\\route.js';
let otpRouteContent = fs.readFileSync(otpRoutePath, 'utf8');

// The issue: AuthPage prepends +91, but /api/auth/otp/send might also add it, 
// OR the user inputted 10 digits and AuthPage sent 10 digits without +91 if they didn't catch the JS condition.
// Actually, AuthPage line 403: value={phone} ... it sends `phone` directly in handleSendOTP, which is JUST the 10 digits.
// In handleComplete it did startswith('+91'). 
// But handleSendOTP: `body: JSON.stringify({ to: phone, code })`. Phone is just "9999999999".
// So otpRoute receives "9999999999".
// otpRoute: 
//         let formattedPhone = to.trim();
//         if (!formattedPhone.startsWith('+')) {
//             formattedPhone = '+91' + formattedPhone;
//         }
// This logic seems correct... but let's make it bulletproof.

const oldLogic = `        // Phone number cleaning
        let formattedPhone = to.trim();
        if (!formattedPhone.startsWith('+')) {
            // Assume India +91 if not specified
            formattedPhone = '+91' + formattedPhone;
        }`;

const newLogic = `        // Phone number cleaning
        let formattedPhone = to.trim();
        // Remove any non-digit characters except the leading +
        formattedPhone = formattedPhone.replace(/(?!^)\\+/g, '').replace(/[^-+0-9]/g, '');
        
        // If it's a 10 digit number without country code, assume India
        if (formattedPhone.length === 10) {
            formattedPhone = '+91' + formattedPhone;
        } else if (!formattedPhone.startsWith('+')) {
            formattedPhone = '+' + formattedPhone;
        }`;

otpRouteContent = otpRouteContent.replace(oldLogic, newLogic);

fs.writeFileSync(otpRoutePath, otpRouteContent, 'utf8');
console.log('Updated formatting in OTP route');
