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

// Function to remove directory
function removeDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        const filePath = path.join(dirPath, file);
        if (fs.lstatSync(filePath).isDirectory()) {
            removeDirectory(filePath);
        } else {
            fs.unlinkSync(filePath);
        }
    }
    fs.rmdirSync(dirPath);
}

// Store active sessions
const activeSessions = new Map();

router.get('/', async (req, res) => {
    const sessionId = makeid(8);
    const tempDir = path.join(__dirname, 'temp', sessionId);
    
    // Create temp directory for this session
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    console.log(`🆕 QR Session Started: ${sessionId}`);
    
    // Set response headers for HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    
    // Send initial HTML
    res.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>DTZ_NOVA_XMD - QR Code</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }
                body {
                    background: url('https://files.catbox.moe/fpyw9m.png') no-repeat center center fixed;
                    background-size: cover;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    padding: 20px;
                    overflow: hidden;
                }
                .container {
                    width: 100%;
                    max-width: 400px;
                    text-align: center;
                    animation: fadeIn 1s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .qr-box {
                    background: rgba(0, 0, 0, 0.85);
                    border-radius: 20px;
                    padding: 30px;
                    border: 3px solid #ff00ff;
                    box-shadow: 0 0 40px rgba(255, 0, 255, 0.6);
                    backdrop-filter: blur(10px);
                }
                .qr-code {
                    width: 250px;
                    height: 250px;
                    margin: 0 auto 20px;
                    border: 5px solid #00ff00;
                    border-radius: 15px;
                    padding: 10px;
                    background: white;
                }
                .qr-code img {
                    width: 100%;
                    height: 100%;
                }
                .loading {
                    color: #ff00ff;
                    font-size: 18px;
                    margin: 20px 0;
                }
                .status {
                    color: white;
                    font-size: 16px;
                    margin: 10px 0;
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
                <div class="qr-box">
                    <h2 style="color: #ff00ff; margin-bottom: 20px;">
                        <i class="fas fa-qrcode"></i> DTZ_NOVA_XMD QR Code
                    </h2>
                    <div class="qr-code" id="qrCodeContainer">
                        <div class="loading">
                            <i class="fas fa-spinner fa-spin"></i> Generating QR Code...
                        </div>
                    </div>
                    <div class="status" id="status">
                        ⏳ Generating QR Code...
                    </div>
                    <div class="timer" id="timer">30s</div>
                    <div id="message" style="color: #00ff00; margin: 10px 0;"></div>
                </div>
            </div>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"></script>
            <script>
                let timeLeft = 30;
                let timerInterval;
                
                function updateQRCode(dataUrl) {
                    const qrContainer = document.getElementById('qrCodeContainer');
                    qrContainer.innerHTML = '<img src="' + dataUrl + '" alt="QR Code">';
                    document.getElementById('status').innerHTML = '<span style="color: #00ff00;">✅ QR Code Generated!</span>';
                    document.getElementById('message').innerHTML = 'Scan this QR code with WhatsApp';
                }
                
                function updateStatus(message, color = 'white') {
                    document.getElementById('status').innerHTML = '<span style="color: ' + color + '">' + message + '</span>';
                }
                
                function startTimer() {
                    const timerElement = document.getElementById('timer');
                    timeLeft = 30;
                    timerElement.textContent = timeLeft + 's';
                    timerElement.style.color = '#ffff00';
                    
                    clearInterval(timerInterval);
                    
                    timerInterval = setInterval(() => {
                        timeLeft--;
                        timerElement.textContent = timeLeft + 's';
                        
                        if (timeLeft <= 10) {
                            timerElement.style.color = '#ff5555';
                        }
                        
                        if (timeLeft <= 0) {
                            clearInterval(timerInterval);
                            updateStatus('⚠️ QR Code Expired! Refresh page for new code', '#ff5555');
                            timerElement.textContent = 'EXPIRED';
                        }
                    }, 1000);
                }
                
                // Use EventSource to listen for updates
                const eventSource = new EventSource('/qr-stream?sessionId=${sessionId}');
                
                eventSource.onmessage = function(event) {
                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'qr') {
                        updateQRCode(data.qr);
                        startTimer();
                    } else if (data.type === 'status') {
                        updateStatus(data.message, data.color);
                    } else if (data.type === 'connected') {
                        updateStatus('✅ Connected! Processing session...', '#00ff00');
                        document.getElementById('message').innerHTML = 'Session is being created...';
                        clearInterval(timerInterval);
                        document.getElementById('timer').textContent = 'CONNECTED';
                    } else if (data.type === 'error') {
                        updateStatus('❌ Error: ' + data.message, '#ff5555');
                        clearInterval(timerInterval);
                    }
                };
                
                eventSource.onerror = function() {
                    updateStatus('⚠️ Connection lost. Refreshing...', '#ff5555');
                    setTimeout(() => {
                        location.reload();
                    }, 3000);
                };
                
                // Initial timer
                startTimer();
            </script>
        </body>
        </html>
    `);
    
    // Store session info
    activeSessions.set(sessionId, {
        tempDir,
        res: null,
        qrSent: false,
        sock: null
    });
    
    // End the response
    res.end();
});

// New endpoint for Server-Sent Events (SSE)
router.get('/qr-stream', async (req, res) => {
    const sessionId = req.query.sessionId;
    
    if (!sessionId || !activeSessions.has(sessionId)) {
        res.writeHead(404);
        res.end();
        return;
    }
    
    const session = activeSessions.get(sessionId);
    
    // Set headers for SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    
    // Send initial connection message
    res.write('data: ' + JSON.stringify({ type: 'status', message: 'Connecting to WhatsApp...' }) + '\n\n');
    
    // Store response for later use
    session.res = res;
    
    // Start WhatsApp connection
    startWhatsAppConnection(sessionId);
    
    // Handle client disconnect
    req.on('close', () => {
        console.log(`Client disconnected from session: ${sessionId}`);
        // Clean up if no longer needed
        if (session.res === res) {
            session.res = null;
        }
    });
});

async function startWhatsAppConnection(sessionId) {
    const session = activeSessions.get(sessionId);
    if (!session) return;
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState(session.tempDir);
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("DTZ_NOVA_XMD"),
            syncFullHistory: false,
            markOnlineOnConnect: true
        });
        
        session.sock = sock;
        
        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            // Handle QR code
            if (qr && !session.qrSent) {
                session.qrSent = true;
                try {
                    // Generate QR code as Data URL
                    const qrDataUrl = await QRCode.toDataURL(qr);
                    
                    // Send QR code via SSE
                    if (session.res) {
                        session.res.write('data: ' + JSON.stringify({
                            type: 'qr',
                            qr: qrDataUrl
                        }) + '\n\n');
                    }
                    
                    console.log(`✅ QR Code generated for session: ${sessionId}`);
                } catch (error) {
                    console.error('QR Generation Error:', error);
                    if (session.res) {
                        session.res.write('data: ' + JSON.stringify({
                            type: 'error',
                            message: 'Failed to generate QR code'
                        }) + '\n\n');
                    }
                }
            }
            
            // Handle connection
            if (connection === "open") {
                console.log(`✅ Connected: ${sock.user.id}`);
                
                if (session.res) {
                    session.res.write('data: ' + JSON.stringify({
                        type: 'connected',
                        message: 'WhatsApp connected successfully'
                    }) + '\n\n');
                }
                
                await delay(2000);
                
                try {
                    // Try to join WhatsApp channel
                    try {
                        await sock.groupAcceptInvite("0029Vb6mfVdEAKWH5Sgs9y2L");
                        console.log('✅ Joined WhatsApp channel');
                    } catch (channelError) {
                        console.log('⚠️ Could not auto-join channel');
                    }
                    
                    // Upload session to MEGA
                    const credsPath = path.join(session.tempDir, 'creds.json');
                    if (fs.existsSync(credsPath)) {
                        try {
                            const megaUrl = await upload(
                                fs.createReadStream(credsPath),
                                `dtz_nova_${sessionId}_${Date.now()}.json`
                            );
                            
                            const sessionCode = megaUrl.split('/file/')[1]?.split('/')[0] || 'error';
                            const sessionMessage = `dtz_nova~${sessionCode}`;
                            
                            // Send session to user
                            await sock.sendMessage(sock.user.id, { 
                                text: `🔐 *YOUR SESSION CODE*\n\n\`\`\`${sessionMessage}\`\`\`\n\nSave this code!`
                            });
                            
                            // Send welcome message
                            const welcomeMsg = `*🎉 WELCOME TO DTZ_NOVA_XMD!*\n\n` +
                                `✅ *Session Created Successfully!*\n\n` +
                                `👤 *Your ID:* ${sock.user.id}\n` +
                                `🔐 *Session Code:* Sent above\n` +
                                `⚠️ *IMPORTANT:* Keep your session code safe!\n\n` +
                                `📢 *Join Our Channel:*\n` +
                                `https://whatsapp.com/channel/0029Vb6mfVdEAKWH5Sgs9y2L\n\n` +
                                `👑 *Developer:* Dulina Nethmira\n` +
                                `🤖 *Bot:* DTZ_NOVA_XMD\n\n` +
                                `_Thank you for using our service! ✨_`;
                            
                            await sock.sendMessage(sock.user.id, {
                                text: welcomeMsg,
                                contextInfo: {
                                    externalAdReply: {
                                        title: "DTZ_NOVA_XMD ✅",
                                        body: "Session Created Successfully",
                                        thumbnailUrl: "https://files.catbox.moe/fpyw9m.png",
                                        sourceUrl: "https://whatsapp.com/channel/0029Vb6mfVdEAKWH5Sgs9y2L",
                                        mediaType: 1,
                                        renderLargerThumbnail: true
                                    }
                                }
                            });
                            
                            console.log(`📤 Session sent to ${sock.user.id}`);
                            
                            if (session.res) {
                                session.res.write('data: ' + JSON.stringify({
                                    type: 'status',
                                    message: '✅ Session created and sent to your WhatsApp!',
                                    color: '#00ff00'
                                }) + '\n\n');
                            }
                            
                        } catch (uploadError) {
                            console.error('Upload Error:', uploadError);
                            await sock.sendMessage(sock.user.id, {
                                text: `❌ *Upload Failed*\n\nError: ${uploadError.message}`
                            });
                            
                            if (session.res) {
                                session.res.write('data: ' + JSON.stringify({
                                    type: 'error',
                                    message: 'Failed to upload session'
                                }) + '\n\n');
                            }
                        }
                    }
                    
                    // Clean up
                    await delay(3000);
                    
                } catch (error) {
                    console.error('Session Processing Error:', error);
                    if (session.res) {
                        session.res.write('data: ' + JSON.stringify({
                            type: 'error',
                            message: 'Failed to process session'
                        }) + '\n\n');
                    }
                } finally {
                    // Cleanup
                    try {
                        await sock.ws.close();
                    } catch {}
                    
                    setTimeout(() => {
                        removeDirectory(session.tempDir);
                        activeSessions.delete(sessionId);
                        console.log(`🧹 Cleaned up session: ${sessionId}`);
                        
                        if (session.res) {
                            session.res.write('data: ' + JSON.stringify({
                                type: 'status',
                                message: '✅ Session completed! You can close this window.',
                                color: '#00ff00'
                            }) + '\n\n');
                            session.res.end();
                        }
                    }, 5000);
                }
            }
            
            // Handle connection closed
            if (connection === "close") {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                
                if (shouldReconnect) {
                    console.log('🔄 Connection closed, attempting reconnect...');
                    if (session.res) {
                        session.res.write('data: ' + JSON.stringify({
                            type: 'status',
                            message: '🔄 Reconnecting...',
                            color: '#ffff00'
                        }) + '\n\n');
                    }
                    
                    setTimeout(() => {
                        startWhatsAppConnection(sessionId);
                    }, 5000);
                } else {
                    console.log('❌ Connection permanently closed');
                    removeDirectory(session.tempDir);
                    activeSessions.delete(sessionId);
                    
                    if (session.res) {
                        session.res.write('data: ' + JSON.stringify({
                            type: 'error',
                            message: 'Connection failed permanently'
                        }) + '\n\n');
                        session.res.end();
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Session Creation Error:', error);
        removeDirectory(session.tempDir);
        activeSessions.delete(sessionId);
        
        if (session.res) {
            session.res.write('data: ' + JSON.stringify({
                type: 'error',
                message: 'Failed to create session: ' + error.message
            }) + '\n\n');
            session.res.end();
        }
    }
}

// Cleanup old sessions periodically
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of activeSessions.entries()) {
        // Remove sessions older than 10 minutes
        if (now - session.createdAt > 10 * 60 * 1000) {
            removeDirectory(session.tempDir);
            activeSessions.delete(sessionId);
            console.log(`🧹 Cleaned up old session: ${sessionId}`);
        }
    }
}, 5 * 60 * 1000); // Check every 5 minutes

module.exports = router;
