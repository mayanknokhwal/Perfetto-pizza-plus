/**
 * testCountdownPillInChrome.js
 * Test order countdown pill rendering in a real Google Chrome browser session.
 */
const { spawn } = require('child_process');
const http = require('http');
const assert = require('assert');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9225;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

class CDPClient {
    constructor(wsUrl) {
        this.ws = new WebSocket(wsUrl);
        this.id = 1;
        this.callbacks = new Map();
        this.isReady = false;

        this.readyPromise = new Promise((resolve, reject) => {
            this.ws.onopen = () => {
                this.isReady = true;
                resolve();
            };
            this.ws.onerror = reject;
        });

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.id && this.callbacks.has(msg.id)) {
                    const { resolve, reject } = this.callbacks.get(msg.id);
                    this.callbacks.delete(msg.id);
                    if (msg.error) reject(msg.error);
                    else resolve(msg.result);
                }
            } catch (e) { }
        };
    }

    async send(method, params = {}) {
        await this.readyPromise;
        return new Promise((resolve, reject) => {
            const id = this.id++;
            this.callbacks.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    close() {
        try { this.ws.close(); } catch (e) { }
    }
}

async function testCountdownInBrowser() {
    const chromeProcess = spawn(CHROME_PATH, [
        `--remote-debugging-port=${DEBUG_PORT}`,
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check'
    ]);

    await sleep(1500);

    let client;
    try {
        const targets = await fetchJson(`http://localhost:${DEBUG_PORT}/json`);
        const pageTarget = targets.find(t => t.type === 'page') || targets[0];
        assert(pageTarget, 'Chrome page target must be found');

        client = new CDPClient(pageTarget.webSocketDebuggerUrl);
        await client.send('Page.enable');
        await client.send('Runtime.enable');

        await client.send('Page.navigate', { url: 'http://localhost:8080' });
        await sleep(2000);

        const evalResult = await client.send('Runtime.evaluate', {
            expression: `(() => {
                localStorage.setItem('perfettoSavedProfile', JSON.stringify({
                    name: 'Test Customer',
                    phone: '9876543210',
                    address: '123 Pizza Street'
                }));
                const now = Date.now();
                const activeOrder = {
                    id: 'ORD_PILL_TEST',
                    orderId: 'ORD_PILL_TEST',
                    customerPhone: '9876543210',
                    status: 'placed',
                    createdAt: new Date(now - 5 * 60 * 1000).toISOString(),
                    items: [{ name: 'Farmhouse Pizza', qty: 1, price: 299 }],
                    total: 299
                };
                localStorage.setItem('perfettoCustomerOrders', JSON.stringify([activeOrder]));
                if (typeof renderOrderHistoryDetails === 'function') {
                    renderOrderHistoryDetails();
                }
                const cdText = typeof getCustomerOrderCountdownText === 'function' ? getCustomerOrderCountdownText(activeOrder) : 'N/A';
                const pillEl = document.querySelector('.order-countdown-pill');
                return {
                    cdText,
                    hasPill: Boolean(pillEl),
                    pillText: pillEl ? pillEl.innerText.trim() : null
                };
            })()`,
            returnByValue: true
        });

        console.log('Customer Order Countdown Test Result:', evalResult.result.value);

        const { cdText, hasPill, pillText } = evalResult.result.value;
        assert(hasPill, 'Order countdown pill must be rendered');
        assert(cdText.includes('1h 35m'), 'Countdown text should be ~1h 35m');
        assert(pillText.includes('1h 35m'), 'Pill text must include countdown duration');
        console.log('✅ Countdown pill correctly rendered in customer order history in real Chrome!');
    } finally {
        if (client) client.close();
        chromeProcess.kill();
    }
}

testCountdownInBrowser().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
