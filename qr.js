const { makeid } = require('./gen-id');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const pino = require("pino");

// Import from baileys-dtz
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay
} = require("baileys-dtz");

const { upload } = require('./mega');

// Function to remove directory
function removeDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    
    try {
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
    } catch (error) {
        console.error('Error removing directory:', error);
    }
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
    
    // Send HTML page
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>DTZ_NOVA_XMD - QR Code</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
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
                }

                .container {
                    width: 100%;
                    max-width: 450px;
                    text-align: center;
                }

                .header {
                    margin-bottom: 30px;
                    animation: fadeIn 1s;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .logo {
                    font-size: 60px;
                    color: #ff00ff;
                    text-shadow: 0 0 30px #ff00ff;
                    margin-bottom: 10px;
                    animation: pulse 2s infinite alternate;
                }

                @keyframes pulse {
                    from { text-shadow: 0 0 30px #ff00ff; }
                    to { text-shadow: 0 0 60px #ff00ff, 0 0 90px #ff00ff; }
                }

                .title {
                    color: white;
                    font-size: 32px;
                    font-weight: bold;
                    margin-bottom: 5px;
                }

                .subtitle {
                    color: #00ff00;
                    font-size: 14px;
                    opacity: 0.9;
                }

                .qr-box {
                    background: rgba(0, 0, 0, 0.85);
                    border-radius: 20px;
                    padding: 30px;
                    border: 3px solid #ff00ff;
                    box-shadow: 0 0 40px rgba(255, 0, 255, 0.6);
                    backdrop-filter: blur(10px);
                    margin-bottom: 20px;
                    animation: slideUp 0.5s ease-out;
                }

                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .qr-container {
                    width: 300px;
                    height: 300px;
                    margin: 0 auto 20px;
                    border: 5px solid #00ff00;
                    border-radius: 15px;
                    padding: 10px;
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                }

                #qrCode {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }

                .qr-placeholder {
                    color: #666;
                    font-size: 18px;
                }

                .status {
                    color: white;
                    font-size: 16px;
                    margin: 15px 0;
                    min-height: 24px;
                }

                .timer {
                    color: #ffff00;
                    font-size: 24px;
                    font-weight: bold;
                    margin: 10px 0;
                    font-family: monospace;
                }

                .progress-container {
                    width: 100%;
                    height: 10px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 5px;
                    margin: 20px 0;
                    overflow: hidden;
                }

                .progress-bar {
                    height: 100%;
                    width: 100%;
                    background: linear-gradient(90deg, #ff00ff, #00ff00);
                    border-radius: 5px;
                    animation: progress 30s linear forwards;
                }

                @keyframes progress {
                    0% { width: 100%; }
                    100% { width: 0%; }
                }

                .actions {
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                    margin-top: 20px;
                }

                .action-btn {
                    padding: 12px 25px;
                    border-radius: 15px;
                    border: none;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.3s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    min-width: 140px;
                }

                .refresh-btn {
                    background: linear-gradient(45deg, #ff00ff, #ff5500);
                    color: white;
                }

                .refresh-btn:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 5px 20px rgba(255, 0, 255, 0.5);
                }

                .home-btn {
                    background: linear-gradient(45deg, #00ff00, #0088ff);
                    color: white;
                }

                .home-btn:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 5px 20px rgba(0, 255, 0, 0.5);
                }

                .instructions {
                    color: #aaa;
                    font-size: 13px;
                    margin-top: 20px;
                    line-height: 1.5;
                    text-align: left;
                }

                .footer {
                    margin-top: 30px;
                    color: white;
                    text-align: center;
                    font-size: 13px;
                    opacity: 0.8;
                }

                .footer a {
                    color: #ff00ff;
                    text-decoration: none;
                }

                .error-message {
                    background: rgba(255, 0, 0, 0.2);
                    color: #ff5555;
                    padding: 15px;
                    border-radius: 10px;
                    border: 1px solid #ff5555;
                    margin: 20px 0;
                    display: none;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">
                        <i class="fas fa-robot"></i>
                    </div>
                    <h1 class="title">DTZ_NOVA_XMD</h1>
                    <p class="subtitle">QR Code Session by Dulina Nethmira</p>
                </div>

                <div class="qr-box">
                    <h2 style="color: #fff; margin-bottom: 20px;">
                        <i class="fas fa-qrcode"></i> Scan QR Code
                    </h2>
                    
                    <div class="qr-container">
                        <div class="qr-placeholder" id="qrPlaceholder">
                            <i class="fas fa-spinner fa-spin"></i> Generating QR Code...
                        </div>
                        <img id="qrCode" style="display: none;" alt="QR Code">
                    </div>

                    <div class="status" id="status">
                        ⏳ Generating QR Code...
                    </div>

                    <div class="progress-container">
                        <div class="progress-bar" id="progressBar"></div>
                    </div>

                    <div class="timer" id="timer">30s</div>

                    <div class="error-message" id="errorMessage"></div>

                    <div class="instructions">
                        <p><i class="fas fa-mobile-alt"></i> <strong>How to scan:</strong></p>
                        <p>1. Open WhatsApp on your phone</p>
                        <p>2. Tap Menu → Linked Devices → Link a Device</p>
                        <p>3. Point your camera at the QR code</p>
                        <p>4. Wait for session to be created</p>
                        <p>5. Check WhatsApp for session code</p>
                    </div>
                </div>

                <div class="actions">
                    <button class="action-btn refresh-btn" onclick="refreshQRCode()">
                        <i class="fas fa-redo"></i> New QR Code
                    </button>
                    <button class="action-btn home-btn" onclick="window.location.href='/'">
                        <i class="fas fa-home"></i> Home
                    </button>
                </div>

                <div class="footer">
                    <p>Created by <strong>Dulina Nethmira</strong></p>
                    <p>
                        <a href="/pair"><i class="fas fa-link"></i> Pair Code</a> | 
                        <a href="https://whatsapp.com/channel/0029Vb6mfVdEAKWH5Sgs9y2L" target="_blank">
                            <i class="fab fa-whatsapp"></i> Join Channel
                        </a>
                    </p>
                    <p>© 2024 DTZ_NOVA_XMD - Session will auto-create after scan</p>
                </div>
            </div>

            <script>
                const sessionId = '${sessionId}';
                let timeLeft = 30;
                let timerInterval;
                let qrGenerated = false;

                // Update status
                function updateStatus(message, color = 'white') {
                    const statusElement = document.getElementById('status');
                    statusElement.innerHTML = message;
                    statusElement.style.color = color;
                }

                // Show error
                function showError(message) {
                    const errorElement = document.getElementById('errorMessage');
                    errorElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + message;
                    errorElement.style.display = 'block';
                    updateStatus('❌ Error occurred', '#ff5555');
                }

                // Update QR code
                function updateQRCode(base64Image) {
                    const qrPlaceholder = document.getElementById('qrPlaceholder');
                    const qrImage = document.getElementById('qrCode');
                    
                    qrPlaceholder.style.display = 'none';
                    qrImage.src = base64Image;
                    qrImage.style.display = 'block';
                    qrGenerated = true;
                    
                    updateStatus('✅ QR Code Generated! Scan with WhatsApp', '#00ff00');
                    startTimer();
                }

                // Start timer
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
                            updateStatus('⚠️ QR Code Expired! Refresh for new code', '#ff5555');
                            timerElement.textContent = 'EXPIRED';
                        }
                    }, 1000);
                }

                // Refresh QR code
                function refreshQRCode() {
                    window.location.reload();
                }

                // Connect to WebSocket for real-time updates
                function connectWebSocket() {
                    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                    const wsUrl = protocol + '//' + window.location.host + '/qr-ws?sessionId=' + sessionId;
                    const ws = new WebSocket(wsUrl);
                    
                    ws.onopen = function() {
                        console.log('WebSocket connected');
                        updateStatus('🔗 Connected to server...', '#00ff00');
                    };
                    
                    ws.onmessage = function(event) {
                        try {
                            const data = JSON.parse(event.data);
                            
                            if (data.type === 'qr') {
                                updateQRCode(data.qr);
                            } else if (data.type === 'status') {
                                updateStatus(data.message, data.color);
                            } else if (data.type === 'connected') {
                                updateStatus('✅ Connected! Creating session...', '#00ff00');
                                document.getElementById('timer').textContent = 'CONNECTED';
                                clearInterval(timerInterval);
                            } else if (data.type === 'error') {
                                showError(data.message);
                                clearInterval(timerInterval);
                            }
                        } catch (error) {
                            console.error('WebSocket message error:', error);
                        }
                    };
                    
                    ws.onerror = function(error) {
                        console.error('WebSocket error:', error);
                        showError('Connection error. Please refresh the page.');
                    };
                    
                    ws.onclose = function() {
                        console.log('WebSocket disconnected');
                        if (!qrGenerated) {
                            showError('Connection lost. Please refresh the page.');
                        }
                    };
                    
                    return ws;
                }

                // Start timer immediately
                startTimer();

                // Connect WebSocket
                let ws = connectWebSocket();

                // Auto-refresh after 30 seconds if no QR
                setTimeout(() => {
                    if (!qrGenerated) {
                        refreshQRCode();
                    }
                }, 31000);

                // Handle page visibility
                document.addEventListener('visibilitychange', () => {
                    if (!document.hidden && ws.readyState === WebSocket.CLOSED) {
                        ws = connectWebSocket();
                    }
                });
            </script>
        </body>
        </html>
    `;
    
    res.send(html);
    
    // Start WhatsApp session in background
    setTimeout(() => {
        startWhatsAppSession(sessionId, tempDir);
    }, 1000);
});

// WebSocket endpoint setup (will be called from index.js)
router.ws = function(server) {
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ noServer: true });
    
    server.on('upgrade', (request, socket, head) => {
        if (request.url.startsWith('/qr-ws')) {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        }
    });
    
    wss.on('connection', (ws, request) => {
        const url = require('url');
        const query = url.parse(request.url, true).query;
        const sessionId = query.sessionId;
        
        if (!sessionId) {
            ws.close();
            return;
        }
        
        // Store WebSocket connection
        if (!activeSessions.has(sessionId)) {
            activeSessions.set(sessionId, { ws: null, createdAt: Date.now() });
        }
        
        const session = activeSessions.get(sessionId);
        session.ws = ws;
        
        ws.on('close', () => {
            if (session.ws === ws) {
                session.ws = null;
            }
        });
    });
    
    return wss;
};

// Function to send message via WebSocket
function sendWSMessage(sessionId, message) {
    const session = activeSessions.get(sessionId);
    if (session && session.ws && session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify(message));
    }
}

// Start WhatsApp session with baileys-dtz
async function startWhatsAppSession(sessionId, tempDir) {
    console.log(`🚀 Starting WhatsApp session with baileys-dtz for ${sessionId}`);
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState(tempDir);
        
        // Fix: Use string for browser instead of Browsers.macOS()
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true, // Enable for debugging
            logger: pino({ level: "silent" }),
            browser: ["Chrome", "Windows", "10.0.0"], // Fix: Use array format
            syncFullHistory: false,
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 30000
        });
        
        // Store socket in session
        const session = activeSessions.get(sessionId) || {};
        session.sock = sock;
        session.createdAt = Date.now();
        activeSessions.set(sessionId, session);
        
        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            console.log(`📡 Connection update: ${connection} for session ${sessionId}`);
            
            // Handle QR code
            if (qr) {
                try {
                    console.log(`📱 QR Code received for session: ${sessionId}`);
                    
                    // Generate QR code as Data URL
                    const qrDataUrl = await QRCode.toDataURL(qr, {
                        width: 300,
                        margin: 2,
                        color: {
                            dark: '#000000FF',
                            light: '#FFFFFFFF'
                        },
                        errorCorrectionLevel: 'H'
                    });
                    
                    // Send QR code via WebSocket
                    sendWSMessage(sessionId, {
                        type: 'qr',
                        qr: qrDataUrl
                    });
                    
                } catch (error) {
                    console.error('QR Generation Error:', error);
                    sendWSMessage(sessionId, {
                        type: 'error',
                        message: 'Failed to generate QR code: ' + error.message
                    });
                }
            }
            
            // Handle connection
            if (connection === "open") {
                console.log(`✅ Connected: ${sock.user.id}`);
                
                sendWSMessage(sessionId, {
                    type: 'connected',
                    message: 'WhatsApp connected successfully'
                });
                
                await delay(2000);
                
                try {
                    // Try to join WhatsApp channel
                    try {
                        await sock.groupAcceptInvite("0029Vb6mfVdEAKWH5Sgs9y2L");
                        console.log('✅ Joined WhatsApp channel');
                    } catch (channelError) {
                        console.log('⚠️ Could not auto-join channel:', channelError.message);
                    }
                    
                    // Upload session to MEGA
                    const credsPath = path.join(tempDir, 'creds.json');
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
                            
                            sendWSMessage(sessionId, {
                                type: 'status',
                                message: '✅ Session created and sent to your WhatsApp!',
                                color: '#00ff00'
                            });
                            
                        } catch (uploadError) {
                            console.error('Upload Error:', uploadError);
                            await sock.sendMessage(sock.user.id, {
                                text: `❌ *Upload Failed*\n\nError: ${uploadError.message}\n\nYour session is still active locally.`
                            });
                            
                            sendWSMessage(sessionId, {
                                type: 'error',
                                message: 'Failed to upload session to cloud'
                            });
                        }
                    }
                    
                    // Send completion message
                    sendWSMessage(sessionId, {
                        type: 'status',
                        message: '✅ Session completed! You can close this window.',
                        color: '#00ff00'
                    });
                    
                    // Clean up after delay
                    setTimeout(() => {
                        cleanupSession(sessionId, tempDir);
                    }, 5000);
                    
                } catch (error) {
                    console.error('Session Processing Error:', error);
                    sendWSMessage(sessionId, {
                        type: 'error',
                        message: 'Failed to process session: ' + error.message
                    });
                }
            }
            
            // Handle connection closed
            if (connection === "close") {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                
                if (shouldReconnect) {
                    console.log('🔄 Connection closed, attempting reconnect...');
                    sendWSMessage(sessionId, {
                        type: 'status',
                        message: '🔄 Reconnecting...',
                        color: '#ffff00'
                    });
                    
                    setTimeout(() => {
                        startWhatsAppSession(sessionId, tempDir);
                    }, 5000);
                } else {
                    console.log('❌ Connection permanently closed');
                    cleanupSession(sessionId, tempDir);
                    
                    sendWSMessage(sessionId, {
                        type: 'error',
                        message: 'Connection failed. Please try again.'
                    });
                }
            }
        });
        
    } catch (error) {
        console.error('Session Creation Error:', error);
        cleanupSession(sessionId, tempDir);
        
        sendWSMessage(sessionId, {
            type: 'error',
            message: 'Failed to create session: ' + error.message
        });
    }
}

// Cleanup session
function cleanupSession(sessionId, tempDir) {
    try {
        const session = activeSessions.get(sessionId);
        if (session && session.sock) {
            try {
                session.sock.ws.close();
            } catch (e) {}
        }
    } catch {}
    
    setTimeout(() => {
        try {
            removeDirectory(tempDir);
            activeSessions.delete(sessionId);
            console.log(`🧹 Cleaned up session: ${sessionId}`);
        } catch (error) {
            console.error('Error cleaning up session:', error);
        }
    }, 5000);
}

// Cleanup old sessions periodically
setInterval(() => {
    const now = Date.now();
    for (const [sessionId, session] of activeSessions.entries()) {
        // Remove sessions older than 10 minutes
        if (session.createdAt && now - session.createdAt > 10 * 60 * 1000) {
            const tempDir = path.join(__dirname, 'temp', sessionId);
            cleanupSession(sessionId, tempDir);
        }
    }
}, 5 * 60 * 1000);

module.exports = router;
