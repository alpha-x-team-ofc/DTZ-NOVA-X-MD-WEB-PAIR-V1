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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║   DTZ_NOVA_XMD Session Generator    ║
║      Created by Dulina Nethmira     ║
║     Server running on port: ${PORT}     ║
╚══════════════════════════════════════╝`);
});

module.exports = app;
