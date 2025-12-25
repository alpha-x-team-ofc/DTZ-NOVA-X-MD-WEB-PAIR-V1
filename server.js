/**
 * DTZ_NOVA_XMD Server Entry Point
 * WhatsApp Session Generator by Dulina Nethmira
 */

const cluster = require('cluster');
const os = require('os');
const app = require('./index');

// Get CPU count for clustering
const cpuCount = os.cpus().length;

// Master process
if (cluster.isMaster) {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║         🚀 DTZ_NOVA_XMD - WhatsApp Session Generator            ║
║                  by Dulina Nethmira                              ║
║                                                                  ║
║     📅 Started: ${new Date().toLocaleString()}                  ║
║     💻 CPUs: ${cpuCount}                                        ║
║     🔧 Environment: ${process.env.NODE_ENV || 'development'}    ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
    `);
    
    // Fork workers
    for (let i = 0; i < cpuCount; i++) {
        cluster.fork();
    }
    
    // Handle worker events
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        
        // Restart worker if not intentional shutdown
        if (!worker.exitedAfterDisconnect) {
            console.log('Starting a new worker...');
            cluster.fork();
        }
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
        
        for (const id in cluster.workers) {
            cluster.workers[id].kill();
        }
        
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
        
        for (const id in cluster.workers) {
            cluster.workers[id].kill();
        }
        
        process.exit(0);
    });
    
} else {
    // Worker processes
    const PORT = process.env.PORT || 8000;
    
    app.listen(PORT, () => {
        console.log(`✅ Worker ${process.pid} started on port ${PORT}`);
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        console.error(`❌ Worker ${process.pid} uncaught exception:`, error);
        process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        console.error(`❌ Worker ${process.pid} unhandled rejection:`, reason);
    });
}
