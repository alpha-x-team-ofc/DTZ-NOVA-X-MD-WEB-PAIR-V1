const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require("body-parser");
const http = require('http');

// Load environment variables
require('dotenv').config();

const PORT = process.env.PORT || 8000;

// Create HTTP server
const server = http.createServer(app);

// Increase event listeners
require('events').EventEmitter.defaultMaxListeners = 500;

// Create directories if not exist
const fs = require('fs');
if (!fs.existsSync('./temp')) {
    fs.mkdirSync('./temp', { recursive: true });
}
if (!fs.existsSync('./logs')) {
    fs.mkdirSync('./logs', { recursive: true });
}

// Import routers
const qrRouter = require('./qr');
const pairRouter = require('./pair');

// Setup WebSocket for QR
const WebSocket = require('ws');
const wss = qrRouter.ws(server);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/server', qrRouter);
app.use('/code', pairRouter);

// HTML Routes
app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.get('/qr', (req, res) => {
    res.sendFile(path.join(__dirname, 'qr.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'DTZ_NOVA_XMD Session Generator',
        version: '3.0.0',
        baileys: 'baileys-dtz',
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Status endpoint
app.get('/status', (req, res) => {
    const qr = require('./qr');
    const activeSessions = Object.keys(require('./qr').activeSessions || {});
    
    res.json({
        status: 'running',
        sessions: activeSessions.length,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Static files (optional)
app.use('/static', express.static(path.join(__dirname, 'static')));

// 404 Handler
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>404 - Page Not Found</title>
            <style>
                body {
                    background: url('https://files.catbox.moe/fpyw9m.png') no-repeat center center fixed;
                    background-size: cover;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    color: white;
                    font-family: Arial, sans-serif;
                    text-align: center;
                }
                .container {
                    background: rgba(0,0,0,0.8);
                    padding: 40px;
                    border-radius: 15px;
                    backdrop-filter: blur(10px);
                }
                h1 {
                    color: #ff00ff;
                    text-shadow: 0 0 10px #ff00ff;
                }
                a {
                    color: #00ff00;
                    text-decoration: none;
                    font-weight: bold;
                }
                a:hover {
                    text-decoration: underline;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>404 - Page Not Found</h1>
                <p>The page you're looking for doesn't exist.</p>
                <p><a href="/">Go Back to Home</a></p>
                <p style="margin-top: 20px;">DTZ_NOVA_XMD by Dulina Nethmira</p>
            </div>
        </body>
        </html>
    `);
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('Server Error:', err.stack);
    res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>500 - Server Error</title>
            <style>
                body {
                    background: url('https://files.catbox.moe/fpyw9m.png') no-repeat center center fixed;
                    background-size: cover;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                    color: white;
                    font-family: Arial, sans-serif;
                    text-align: center;
                }
                .container {
                    background: rgba(0,0,0,0.8);
                    padding: 40px;
                    border-radius: 15px;
                    backdrop-filter: blur(10px);
                }
                h1 {
                    color: #ff0000;
                    text-shadow: 0 0 10px #ff0000;
                }
                a {
                    color: #00ff00;
                    text-decoration: none;
                    font-weight: bold;
                }
                pre {
                    background: rgba(255,0,0,0.2);
                    padding: 10px;
                    border-radius: 5px;
                    text-align: left;
                    overflow: auto;
                    max-height: 200px;
                    font-size: 12px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>500 - Server Error</h1>
                <p>Something went wrong on our end. Please try again later.</p>
                <details>
                    <summary>Error Details</summary>
                    <pre>${err.message}</pre>
                </details>
                <p><a href="/">Go Back to Home</a></p>
                <p style="margin-top: 20px;">DTZ_NOVA_XMD by Dulina Nethmira</p>
            </div>
        </body>
        </html>
    `);
});

// Handle server errors
server.on('error', (error) => {
    console.error('HTTP Server Error:', error);
});

// WebSocket server events
wss.on('connection', (ws) => {
    console.log('🔗 New WebSocket connection');
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Graceful shutdown
function gracefulShutdown(signal) {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    
    // Close WebSocket connections
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.close(1000, 'Server shutting down');
        }
    });
    
    // Close WebSocket server
    wss.close(() => {
        console.log('✅ WebSocket server closed');
        
        // Close HTTP server
        server.close(() => {
            console.log('✅ HTTP server closed');
            
            // Cleanup temp directory
            try {
                const fs = require('fs');
                const path = require('path');
                const tempDir = path.join(__dirname, 'temp');
                
                if (fs.existsSync(tempDir)) {
                    const files = fs.readdirSync(tempDir);
                    for (const file of files) {
                        const filePath = path.join(tempDir, file);
                        if (fs.lstatSync(filePath).isDirectory()) {
                            fs.rmSync(filePath, { recursive: true, force: true });
                        }
                    }
                    console.log('🧹 Temp directory cleaned');
                }
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError);
            }
            
            process.exit(0);
        });
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
        console.log('⚠️ Forcing shutdown...');
        process.exit(1);
    }, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start Server
server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║         🚀 DTZ_NOVA_XMD SESSION GENERATOR v3.0.0                ║
║                  by Dulina Nethmira                              ║
║                     Using baileys-dtz                            ║
║                                                                  ║
║     📅 Started: ${new Date().toLocaleString()}                  ║
║     🌐 Server:  http://localhost:${PORT}                        ║
║     📡 WebSocket: ws://localhost:${PORT}/qr-ws                   ║
║                                                                  ║
║     📱 QR Code:    http://localhost:${PORT}/qr                    ║
║     🔢 Pair Code:  http://localhost:${PORT}/pair                  ║
║     ❤️  Health:    http://localhost:${PORT}/health                ║
║     📊 Status:     http://localhost:${PORT}/status                ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
