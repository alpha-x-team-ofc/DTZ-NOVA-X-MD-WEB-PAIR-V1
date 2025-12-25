const { makeid } = require('./gen-id');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
const router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers
} = require("@whiskeysockets/baileys");
const { upload } = require('./mega');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();
    
    async function DTZ_NOVA_SESSION() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        
        try {
            let sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: Browsers.macOS("Desktop"),
            });
            
            sock.ev.on('creds.update', saveCreds);
            
            sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (qr) {
                    try {
                        const qrBuffer = await QRCode.toBuffer(qr);
                        res.end(qrBuffer);
                    } catch (error) {
                        console.error('QR generation error:', error);
                    }
                }
                
                if (connection === "open") {
                    await delay(3000);
                    
                    try {
                        // Auto-join WhatsApp channel
                        const channelJid = "120363312112854560@g.us";
                        await sock.groupAcceptInvite("0029Vb6mfVdEAKWH5Sgs9y2L");
                        
                        // Upload session to Mega
                        const filePath = __dirname + `/temp/${id}/creds.json`;
                        if (fs.existsSync(filePath)) {
                            const megaUrl = await upload(fs.createReadStream(filePath), `${sock.user.id}.json`);
                            const stringSession = megaUrl.replace('https://mega.nz/file/', '');
                            
                            // Send session to user
                            const sessionMessage = `dtz_nova~${stringSession}`;
                            await sock.sendMessage(sock.user.id, { text: sessionMessage });
                            
                            // Send welcome message
                            const welcomeMsg = `*🎉 Welcome to DTZ_NOVA_XMD!*\n\n` +
                                `✅ *Session Created Successfully!*\n` +
                                `🔐 *Session ID:* Sent above\n` +
                                `⚠️ *Keep it safe!* Do NOT share with anyone.\n\n` +
                                `*📢 Join Our Channel:*\n` +
                                `https://whatsapp.com/channel/0029Vb6mfVdEAKWH5Sgs9y2L\n\n` +
                                `*👑 Developer:* Dulina Nethmira\n` +
                                `*🤖 Bot:* DTZ_NOVA_XMD\n\n` +
                                `_Happy messaging! ✨_`;
                            
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
                        }
                        
                        // Cleanup
                        await delay(1000);
                        await sock.ws.close();
                        removeFile('./temp/' + id);
                        console.log(`✅ ${sock.user.id} Connected - Session delivered`);
                        
                    } catch (error) {
                        console.error('Session delivery error:', error);
                        await sock.sendMessage(sock.user.id, { 
                            text: `❌ Error: ${error.message}\n\nContact support if this persists.`
                        });
                    }
                    
                    await delay(2000);
                    process.exit(0);
                    
                } else if (connection === "close") {
                    if (lastDisconnect?.error?.output?.statusCode !== 401) {
                        await delay(5000);
                        DTZ_NOVA_SESSION();
                    }
                }
            });
            
        } catch (error) {
            console.error('Connection error:', error);
            removeFile('./temp/' + id);
            if (!res.headersSent) {
                res.status(500).send('Service unavailable');
            }
        }
    }
    
    await DTZ_NOVA_SESSION();
});

// Auto-restart every 30 minutes
setInterval(() => {
    console.log("🔄 Restarting process...");
    process.exit(0);
}, 30 * 60 * 1000);

module.exports = router;
