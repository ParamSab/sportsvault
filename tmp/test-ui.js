const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    page.on('pageerror', err => {
        console.error('PAGE_ERROR:', err.toString());
    });
    
    page.on('console', msg => {
        if (msg.type() === 'error') console.error('CONSOLE_ERROR:', msg.text());
    });
    
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    console.log('Finished loading!');
    await browser.close();
})();
