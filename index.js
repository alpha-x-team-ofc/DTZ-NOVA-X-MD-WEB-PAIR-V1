const express = require('express');
const app = express();
const __path = process.cwd();
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;
const server = require('./qr');
const code = require('./pair');

// Increase event listeners
require('events').EventEmitter.defaultMaxListeners = 500;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static routes
app.use('/server', server);
app.use('/code', code);
app.use('/qr-stream', server); // Add SSE route

// HTML routes
app.use('/pair', (req, res) => {
    res.sendFile(__path + '/pair.html');
});

app.use('/qr', (req, res) => {
    res.sendFile(__path + '/qr.html');
});

app.use('/', (req, res) => {
    res.sendFile(__path + '/main.html');
});

// Create temp directory if not exists
const fs = require('fs');
if (!fs.existsSync('./temp')) {
    fs.mkdirSync('./temp', { recursive: true });
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
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
            </style>
        </head>
        <body>
            <div class="container">
                <h1>500 - Server Error</h1>
                <p>Something went wrong on our end. Please try again later.</p>
                <p><a href="/">Go Back to Home</a></p>
                <p style="margin-top: 20px;">DTZ_NOVA_XMD by Dulina Nethmira</p>
            </div>
        </body>
        </html>
    `);
});

// Start Server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════╗
║                                                ║
║         🚀 DTZ_NOVA_XMD SESSION GENERATOR      ║
║             by Dulina Nethmira                 ║
║                                                ║
║     🌐 Server running on: http://localhost:${PORT}  ║
║                                                ║
║     📱 QR Code:    http://localhost:${PORT}/qr      ║
║     🔢 Pair Code:  http://localhost:${PORT}/pair    ║
║                                                ║
╚════════════════════════════════════════════════╝
    `);
});

module.exports = app;
