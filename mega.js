const mega = require("megajs");

// Use environment variables for security
let email = process.env.MEGA_EMAIL || '';
let pw = process.env.MEGA_PASSWORD || '';

const auth = {
    'email': email,
    'password': pw,
    'userAgent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

const upload = (stream, filename) => {
    return new Promise((resolve, reject) => {
        try {
            const storage = new mega.Storage(auth, () => {
                const options = {
                    name: filename,
                    allowUploadBuffering: true
                };
                
                stream.pipe(storage.upload(options, (err, file) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    file.link((err, url) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        storage.close();
                        resolve(url);
                    });
                }));
            });
        } catch (err) {
            reject(err);
        }
    });
};

module.exports = { upload };
