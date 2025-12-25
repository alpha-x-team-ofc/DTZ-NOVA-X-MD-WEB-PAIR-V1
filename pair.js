const { makeid } = require('./gen-id');
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const pino = require("pino");

// Import from baileys-dtz
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore
} = require('baileys-dtz');

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

router.get('/', async (req, res) => {
    const { number } = req.query;
    
    if (!number) {
        return res.json({ 
            error: true,
            message: "Phone number is required",
            example: "/code?number=1234567890"
        });
    }
    
    // Clean phone number
    const cleanNumber = number.replace(/[^0-9]/g, '');
    
    if (cleanNumber.length < 10) {
        return res.json({
            error: true,
            message: "Invalid phone number format",
            hint: "Include country code (e.g., 1234567890)"
        });
    }
    
    const sessionId = makeid(8);
    const tempDir = path.join(__dirname, 'temp', sessionId);
    
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    console.log(`🆕 Pairing Session with baileys-dtz: ${sessionId} for ${cleanNumber}`);
    
    async function startPairingSession() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(tempDir);
            
            const sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: Browsers.macOS("DTZ_NOVA_XMD"),
                syncFullHistory: false,
                generateHighQualityLinkPreview: true,
                defaultQueryTimeoutMs: 60000
            });
            
            // Request pairing code if not registered
            if (!sock.authState.creds.registered) {
                await delay(1000);
                
                try {
                    console.log(`📱 Requesting pairing code for ${cleanNumber}`);
                    const pairingCode = await sock.requestPairingCode(cleanNumber);
                    
                    console.log(`✅ Pairing code generated: ${pairingCode}`);
                    
                    // Send pairing code response
                    return res.json({
                        success: true,
                        code: pairingCode,
                        message: "Use this code in WhatsApp > Linked Devices",
                        sessionId: sessionId,
                        expiresIn: "2 minutes"
                    });
                    
                } catch (pairError) {
                    console.error('Pairing Error:', pairError);
                    removeDirectory(tempDir);
                    
                    return res.json({
                        error: true,
                        message: "Failed to generate pairing code",
                        details: pairError.message
                    });
                }
            }
            
            sock.ev.on('creds.update', saveCreds);
            
            sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect } = update;
                
                console.log(`📡 Pairing connection update: ${connection}`);
                
                if (connection === "open") {
                    console.log(`✅ Paired Successfully: ${sock.user.id}`);
                    
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
                                    `dtz_nova_pair_${sessionId}_${Date.now()}.json`
                                );
                                
                                const sessionCode = megaUrl.split('/file/')[1]?.split('/')[0] || 'error';
                                const sessionMessage = `dtz_nova~${sessionCode}`;
                                
                                // Send session to user
                                await sock.sendMessage(sock.user.id, { 
                                    text: `🔐 *YOUR SESSION CODE*\n\n\`\`\`${sessionMessage}\`\`\`\n\nSave this code!`
                                });
                                
                                // Send welcome message
                                const welcomeMsg = `*🎉 WELCOME TO DTZ_NOVA_XMD!*\n\n` +
                                    `✅ *Paired Successfully!*\n\n` +
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
                                            body: "Paired Successfully",
                                            thumbnailUrl: "https://files.catbox.moe/fpyw9m.png",
                                            sourceUrl: "https://whatsapp.com/channel/0029Vb6mfVdEAKWH5Sgs9y2L",
                                            mediaType: 1,
                                            renderLargerThumbnail: true
                                        }
                                    }
                                });
                                
                                console.log(`📤 Session sent to ${sock.user.id}`);
                                
                            } catch (uploadError) {
                                console.error('Upload Error:', uploadError);
                                await sock.sendMessage(sock.user.id, {
                                    text: `❌ *Upload Failed*\n\nError: ${uploadError.message}\n\nYour session is still active locally.`
                                });
                            }
                        }
                        
                        // Clean up
                        await delay(3000);
                        
                    } catch (error) {
                        console.error('Post-Pairing Error:', error);
                    } finally {
                        // Cleanup
                        try {
                            await sock.ws.close();
                        } catch {}
                        
                        setTimeout(() => {
                            removeDirectory(tempDir);
                            console.log(`🧹 Cleaned up pairing session: ${sessionId}`);
                        }, 5000);
                    }
                }
                
                if (connection === "close") {
                    const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
                    
                    if (shouldReconnect) {
                        console.log('🔄 Pairing connection closed, reconnecting...');
                        setTimeout(() => {
                            startPairingSession();
                        }, 5000);
                    } else {
                        console.log('❌ Pairing failed');
                        removeDirectory(tempDir);
                    }
                }
            });
            
        } catch (error) {
            console.error('Pairing Session Error:', error);
            removeDirectory(tempDir);
            
            return res.json({
                error: true,
                message: "Session creation failed",
                details: error.message
            });
        }
    }
    
    await startPairingSession();
});

module.exports = router;
