const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require("body-parser");
const http = require('http');
const WebSocket = require('ws');

// Load environment variables
require('dotenv').config();

const PORT = process.env.PORT || 8000;

// Create HTTP server
const server = http.createServer(app);

// Increase event listeners
require('events').EventEmitter.defaultMaxListeners = 500;

// Create temp directory if not exists
const fs = require('fs');
if (!fs.existsSync('./temp')) {
    fs.mkdirSync('./temp', { recursive: true });
}

// Create logs directory if not exists
if (!fs.existsSync('./logs')) {
    fs.mkdirSync('./logs', { recursive: true });
}

// Import routers
const qrRouter = require('./qr');
const pairRouter = require('./pair');

// Setup WebSocket for QR
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
        version: '2.0.0',
        uptime: process.uptime()
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

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
    wss.close(() => {
        console.log('✅ WebSocket server closed');
        server.close(() => {
            console.log('✅ HTTP server closed');
            process.exit(0);
        });
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
    wss.close(() => {
        console.log('✅ WebSocket server closed');
        server.close(() => {
            console.log('✅ HTTP server closed');
            process.exit(0);
        });
    });
});

// Start Server
server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║         🚀 DTZ_NOVA_XMD SESSION GENERATOR v2.0.0                ║
║                  by Dulina Nethmira                              ║
║                Using @rexxhayanasi/elaina-baileys                ║
║                                                                  ║
║     🌐 Server running on: http://localhost:${PORT}                  ║
║     📡 WebSocket ready on: ws://localhost:${PORT}/qr-ws           ║
║                                                                  ║
║     📱 QR Code:    http://localhost:${PORT}/qr                    ║
║     🔢 Pair Code:  http://localhost:${PORT}/pair                  ║
║     ❤️  Health:    http://localhost:${PORT}/health                ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
