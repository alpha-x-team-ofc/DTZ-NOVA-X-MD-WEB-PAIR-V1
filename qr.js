const { makeid } = require('./gen-id');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const pino = require("pino");

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers
} = require("@whiskeysockets/baileys");

const { upload } = require('./mega');

function removeDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    try {
        fs.rmSync(dirPath, { recursive: true, force: true });
    } catch (error) {
        console.error('Error removing directory:', error);
    }
}

router.get('/', async (req, res) => {
    const sessionId = makeid(8);
    const tempDir = path.join(__dirname, 'temp', sessionId);
    
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    console.log(`🆕 Starting QR session: ${sessionId}`);
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState(tempDir);
        
        let qrGenerated = false;
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true, // Enable for debugging
            logger: pino({ level: "info" }),
            browser: Browsers.macOS("DTZ_NOVA_XMD"),
            syncFullHistory: false
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            // Generate and send QR code
            if (qr && !qrGenerated) {
                qrGenerated = true;
                try {
                    // Generate QR code as PNG
                    const qrBuffer = await QRCode.toBuffer(qr, {
                        width: 400,
                        margin: 2,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        }
                    });
                    
                    // Convert to base64 for HTML embedding
                    const qrBase64 = qrBuffer.toString('base64');
                    
                    // Send HTML with embedded QR code
                    const html = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>DTZ_NOVA_XMD - QR Code</title>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <style>
                                body {
                                    background: url('https://files.catbox.moe/fpyw9m.png') no-repeat center center fixed;
                                    background-size: cover;
                                    display: flex;
                                    justify-content: center;
                                    align-items: center;
                                    min-height: 100vh;
                                    margin: 0;
                                    padding: 20px;
                                    font-family: Arial, sans-serif;
                                }
                                .container {
                                    background: rgba(0,0,0,0.85);
                                    padding: 30px;
                                    border-radius: 20px;
                                    text-align: center;
                                    border: 3px solid #ff00ff;
                                    box-shadow: 0 0 30px rgba(255,0,255,0.5);
                                    backdrop-filter: blur(10px);
                                    max-width: 450px;
                                    width: 100%;
                                }
                                h2 {
                                    color: #ff00ff;
                                    margin-bottom: 20px;
                                    text-shadow: 0 0 10px #ff00ff;
                                }
                                .qr-code {
                                    background: white;
                                    padding: 15px;
                                    border-radius: 15px;
                                    border: 5px solid #00ff00;
                                    margin: 20px auto;
                                    width: 300px;
                                    height: 300px;
                                }
                                .qr-code img {
                                    width: 100%;
                                    height: 100%;
                                    object-fit: contain;
                                }
                                .status {
                                    color: #00ff00;
                                    font-size: 16px;
                                    margin: 15px 0;
                                    font-weight: bold;
                                }
                                .timer {
                                    color: #ffff00;
                                    font-size: 24px;
                                    font-weight: bold;
                                    margin: 10px 0;
                                    font-family: monospace;
                                }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <h2>📱 DTZ_NOVA_XMD QR Code</h2>
                                <div class="status">Scan this QR code with WhatsApp</div>
                                <div class="qr-code">
                                    <img src="data:image/png;base64,${qrBase64}" alt="QR Code">
                                </div>
                                <div class="timer" id="timer">30s</div>
                                <div class="status" id="status">Waiting for scan...</div>
                            </div>
                            <script>
                                let timeLeft = 30;
                                const timerElement = document.getElementById('timer');
                                const statusElement = document.getElementById('status');
                                
                                function updateTimer() {
                                    timeLeft--;
                                    timerElement.textContent = timeLeft + 's';
                                    
                                    if (timeLeft <= 10) {
                                        timerElement.style.color = '#ff5555';
                                    }
                                    
                                    if (timeLeft <= 0) {
                                        clearInterval(timerInterval);
                                        timerElement.textContent = 'EXPIRED';
                                        statusElement.innerHTML = '<span style="color: #ff5555">QR Code Expired! Refresh page</span>';
                                    }
                                }
                                
                                const timerInterval = setInterval(updateTimer, 1000);
                                
                                // Auto-refresh after 30 seconds
                                setTimeout(() => {
                                    location.reload();
                                }, 31000);
                            </script>
                        </body>
                        </html>
                    `;
                    
                    res.setHeader('Content-Type', 'text/html');
                    res.send(html);
                    
                } catch (error) {
                    console.error('QR generation error:', error);
                    res.status(500).send(`
                        <html>
                        <body style="background: #f0f0f0; display: flex; justify-content: center; align-items: center; height: 100vh;">
                            <div style="background: white; padding: 30px; border-radius: 10px; text-align: center;">
                                <h2 style="color: red;">QR Code Generation Failed</h2>
                                <p>Error: ${error.message}</p>
                                <button onclick="location.reload()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
                                    Try Again
                                </button>
                            </div>
                        </body>
                        </html>
                    `);
                }
            }
            
            if (connection === "open") {
                console.log(`✅ Connected: ${sock.user.id}`);
                
                // Process session
                try {
                    await delay(2000);
                    
                    // Upload session to MEGA
                    const credsPath = path.join(tempDir, 'creds.json');
                    if (fs.existsSync(credsPath)) {
                        const megaUrl = await upload(
                            fs.createReadStream(credsPath),
                            `dtz_nova_${sessionId}.json`
                        );
                        
                        const sessionCode = megaUrl.split('/file/')[1]?.split('/')[0];
                        const sessionMessage = `dtz_nova~${sessionCode}`;
                        
                        await sock.sendMessage(sock.user.id, { 
                            text: `🔐 *YOUR SESSION CODE*\n\n\`\`\`${sessionMessage}\`\`\`\n\nSave this code!`
                        });
                    }
                    
                    await delay(3000);
                    await sock.ws.close();
                    removeDirectory(tempDir);
                    
                } catch (error) {
                    console.error('Session processing error:', error);
                }
            }
            
            if (connection === "close") {
                console.log('Connection closed');
                removeDirectory(tempDir);
            }
        });
        
    } catch (error) {
        console.error('Session error:', error);
        removeDirectory(tempDir);
        res.status(500).send('Session creation failed');
    }
});

module.exports = router;
