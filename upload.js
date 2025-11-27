const axios = require('axios');
const Busboy = require('busboy');

// ImgBB API Anahtarınızı buraya girin
const API_KEY = "2fe7db44ef101ea61577db747997365e"; 
const API_URL = "https://api.imgbb.com/1/upload";

// İsteğin body'sindeki görsel dosyasını Base64 formatına çeviren yardımcı işlev
function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        let fileBase64 = '';
        let fileName = 'unknown';

        // Busboy: multipart/form-data yüklerini işlemek için kullanılır
        const busboy = Busboy({ headers: req.headers });

        busboy.on('file', (name, file, info) => {
            if (name !== 'image_file') {
                file.resume(); 
                return;
            }
            
            fileName = info.filename;
            const chunks = [];
            file.on('data', (chunk) => {
                chunks.push(chunk);
            });
            file.on('end', () => {
                const buffer = Buffer.concat(chunks);
                fileBase64 = buffer.toString('base64');
            });
        });

        busboy.on('finish', () => {
            if (fileBase64) {
                resolve({ fileBase64, fileName });
            } else {
                reject(new Error("Görsel dosyası bulunamadı veya boş."));
            }
        });

        busboy.on('error', (err) => reject(err));
        
        req.pipe(busboy);
    });
}


module.exports = async (req, res) => {
    // Sadece POST isteklerini kabul et
    if (req.method !== 'POST') {
        res.status(405).send('Yalnızca POST metoduna izin verilir.');
        return;
    }

    try {
        const { fileBase64, fileName } = await parseMultipart(req);

        if (!fileBase64) {
            return res.status(400).json({ success: false, message: 'Görsel dosyası yüklenmedi.' });
        }

        const payload = {
            key: API_KEY,
            image: fileBase64,
            expiration: 0 
        };

        const response = await axios.post(API_URL, payload);
        const veri = response.data;
        
        if (veri.success && "data" in veri) {
            // Başarılı yanıt: link ve delete_hash'i döndür
            res.status(200).json({
                success: true,
                link: veri.data.url,
                delete_hash: veri.data.delete_hash,
                fileName: fileName
            });
        } else {
            // API'den gelen hata
            res.status(400).json({
                success: false,
                message: veri.error.message || "Bilinmeyen ImgBB Hatası"
            });
        }

    } catch (error) {
        console.error("Yükleme sırasında hata:", error.message);
        res.status(500).json({ 
            success: false, 
            message: `Sunucu Hatası: ${error.message}`
        });
    }
};