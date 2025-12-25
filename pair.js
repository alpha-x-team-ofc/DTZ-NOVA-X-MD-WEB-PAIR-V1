const { makeid } = require('./gen-id');
const express = require('express');
const fs = require('fs');
const router = express.Router();
const pino = require("pino");
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    Browsers, 
    makeCacheableSignalKeyStore 
} = require('@whiskeysockets/baileys');
const { upload } = require('./mega');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;
    
    if (!num || num.replace(/[^0-9]/g, '').length < 10) {
        return res.send({ code: "❌ Invalid number format" });
    }
    
    async function DTZ_NOVA_SESSION() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        
        try {
            let sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: Browsers.macOS("Safari")
            });
            
            // Request pairing code
            if (!sock.authState.creds.registered) {
                await delay(1000);
                num = num.replace(/[^0-9]/g, '');
                try {
                    const code = await sock.requestPairingCode(num);
                    if (!res.headersSent) {
                        res.send({ code });
                    }
                } catch (error) {
                    if (!res.headersSent) {
                        res.send({ code: "❌ Failed to get pairing code" });
                    }
                    return;
                }
            }
            
            sock.ev.on('creds.update', saveCreds);
            
            sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect } = update;
                
                if (connection === "open") {
                    await delay(3000);
                    
                    try {
                        // Auto-join WhatsApp channel
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
                        console.log(`✅ ${sock.user.id} Connected via Pairing Code`);
                        
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
                res.send({ code: "❌ Service unavailable" });
            }
        }
    }
    
    await DTZ_NOVA_SESSION();
});

module.exports = router;
