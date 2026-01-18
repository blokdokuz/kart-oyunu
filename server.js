const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname)));

// --- OYUN DEĞİŞKENLERİ ---
let koltuklar = [null, null, null, null]; 
let koltukTokenleri = [null, null, null, null]; 
let oyuncuIsimleri = [null, null, null, null]; 
let oyuncuElleri = [[], [], [], []]; 
let oyuncular = {}; 
let oyunBasladi = false;
let sira = -1; 
let kartSayilari = [0, 0, 0, 0]; 

// Aktif Oyun Modu
let aktifOyunModu = 'serbest'; 

// --- YENİ: ZAMAN AŞIMI DEĞİŞKENLERİ ---
let zamanlayici = null;
const ZAMAN_ASIMI_SURESI = 10 * 60 * 1000; // 10 Dakika
// -------------------------------------

// --- VERİ YAPILARI ---
let yerdekiKartlar = []; 
let oyuncuSkorlari = [0, 0, 0, 0]; 
let oyuncuToplananKartlar = [[], [], [], []]; 
let bitenOyunlar = []; 
let sonToplamaYedegi = null; 

const semboller = ['♥', '♠', '♦', '♣'];
const degerler = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const siraliSemboller = ['♠', '♦', '♣', '♥']; 
const siraliDegerler = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

// --- YARDIMCI FONKSİYONLAR ---

function desteOlustur() {
    let deste = [];
    for (let s of semboller) {
        for (let d of degerler) { deste.push({ sembol: s, deger: d }); }
    }
    return deste;
}

function desteyiKaristir(deste) {
    for (let i = deste.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deste[i], deste[j]] = [deste[j], deste[i]];
    }
    return deste;
}

// --- YENİ: ZAMANLAYICI MANTIĞI ---
function aktiviteGuncelle() {
    // Mevcut sayacı iptal et
    if (zamanlayici) clearTimeout(zamanlayici);

    // Masada kimse yoksa sayacı başlatmaya gerek yok
    const masadaBiriVarMi = koltuklar.some(x => x !== null);
    if (!masadaBiriVarMi) return;

    // Yeni sayaç başlat
    zamanlayici = setTimeout(() => {
        console.log("ZAMAN AŞIMI: Masa hareketsizlik nedeniyle temizleniyor.");
        masayiZorlaTemizle();
    }, ZAMAN_ASIMI_SURESI);
}

function masayiZorlaTemizle() {
    // 1. Oyunu Sıfırla
    oyunuKompleSifirla();
    
    // 2. Koltukları Boşalt
    koltuklar = [null, null, null, null];
    koltukTokenleri = [null, null, null, null];
    oyuncuIsimleri = [null, null, null, null];
    oyuncular = {};
    
    // 3. Herkese Bildir (Sayfayı yenilemeleri için)
    io.emit('zamanAsimiOldu'); 
    
    // 4. Masa Durumunu Güncelle (Boş haliyle)
    io.emit('masaDurumu', { koltuklar: koltuklar, isimler: oyuncuIsimleri });
}
// -------------------------------------

function oyunuBitir() {
    const oyunKaydi = {
        oyunNo: bitenOyunlar.length + 1,
        tarih: new Date(),
        skorlar: [...oyuncuSkorlari],
        toplananKartlarDetay: JSON.parse(JSON.stringify(oyuncuToplananKartlar))
    };
    bitenOyunlar.push(oyunKaydi);
    
    console.log("Oyun Bitti. Kayıt:", oyunKaydi);
    io.emit('oyunBitti', { toplananKartlar: oyuncuToplananKartlar });
    aktiviteGuncelle(); // Sayaç
}

function oyunuKompleSifirla() {
    console.log("Oyun sıfırlanıyor (Biri ayrıldı veya zaman aşımı)...");
    oyunBasladi = false;
    sira = -1;
    yerdekiKartlar = [];
    oyuncuSkorlari = [0, 0, 0, 0];
    oyuncuElleri = [[], [], [], []];
    kartSayilari = [0, 0, 0, 0];
    oyuncuToplananKartlar = [[], [], [], []];
    sonToplamaYedegi = null;
    aktifOyunModu = 'serbest';
    
    // Herkese bildir
    io.emit('masaTemizlendi', { toplayanKoltuk: -1, yeniSkorlar: [0,0,0,0] });
    io.emit('yerdekiKartlariGuncelle', []);
    io.emit('kartSayilariGuncelle', [0,0,0,0]);
    io.emit('oyunModuGuncelle', 'serbest');
    
    // Masada kalanların ellerini temizle
    koltuklar.forEach(sId => {
        if(sId) io.to(sId).emit('elDagitildi', []); 
    });
}

// -------------------------------------------------------------
// OYUN BAŞLATMA MANTIĞI
// -------------------------------------------------------------

function baslatSerbestOyun() {
    console.log("Serbest Oyun (v4.0) başlatılıyor...");
    sira = -1; 
    kartSayilari = [13, 13, 13, 13];
    oyuncuElleri = [[], [], [], []]; 
    yerdekiKartlar = [];
    oyuncuToplananKartlar = [[], [], [], []];
    oyuncuSkorlari = [0, 0, 0, 0];
    sonToplamaYedegi = null; 

    io.emit('siraGuncelle', sira);
    io.emit('kartSayilariGuncelle', kartSayilari);
    io.emit('masaTemizlendi', { toplayanKoltuk: -1, yeniSkorlar: oyuncuSkorlari }); 
    io.emit('yerdekiKartlariGuncelle', []); 

    let deste = desteyiKaristir(desteOlustur());
    
    for(let i=0; i<4; i++) {
        let el = deste.slice(i * 13, (i + 1) * 13);
        el.sort((a, b) => {
            let sembolFarki = siraliSemboller.indexOf(a.sembol) - siraliSemboller.indexOf(b.sembol);
            if (sembolFarki !== 0) return sembolFarki;
            return siraliDegerler.indexOf(a.deger) - siraliDegerler.indexOf(b.deger);
        });
        oyuncuElleri[i] = el; 
    }

    koltuklar.forEach((socketId, index) => {
        if(socketId) {
            io.to(socketId).emit('elDagitildi', oyuncuElleri[index]);
        }
    });
    aktiviteGuncelle(); // Sayaç
}

function baslatKingOyun() {
    console.log("King oyunu başlatılmak istendi.");
    baslatSerbestOyun();
}

function oyunuBaslatGenel() {
    if (aktifOyunModu === 'king') {
        baslatKingOyun();
    } else {
        baslatSerbestOyun();
    }
}
// -------------------------------------------------------------

io.on('connection', (socket) => {
    socket.emit('masaDurumu', { koltuklar: koltuklar, isimler: oyuncuIsimleri });
    socket.emit('oyunModuGuncelle', aktifOyunModu);

    // --- RECONNECT ---
    socket.on('tekrarBaglan', (token) => {
        if (!oyunBasladi) return; 

        const eskiKoltukIndex = koltukTokenleri.indexOf(token);
        if (eskiKoltukIndex !== -1) {
            console.log(`Oyuncu geri döndü: Koltuk ${eskiKoltukIndex}`);
            koltuklar[eskiKoltukIndex] = socket.id; 
            oyuncular[socket.id] = eskiKoltukIndex;
            
            socket.emit('koltukAtandi', { koltukNo: eskiKoltukIndex });
            
            if (oyuncuElleri[eskiKoltukIndex].length > 0) {
                 socket.emit('elDagitildi', oyuncuElleri[eskiKoltukIndex]);
            }
            
            socket.emit('yerdekiKartlariGuncelle', yerdekiKartlar);
            socket.emit('skorGuncelle', oyuncuSkorlari);
            socket.emit('siraGuncelle', sira);
            socket.emit('kartSayilariGuncelle', kartSayilari);
            io.emit('masaDurumu', { koltuklar: koltuklar, isimler: oyuncuIsimleri });
            
            aktiviteGuncelle(); // Sayaç
        }
    });

    socket.on('oyunModuDegisti', (yeniMod) => {
        if (!oyunBasladi) {
            aktifOyunModu = yeniMod;
            io.emit('oyunModuGuncelle', aktifOyunModu);
            console.log("Oyun modu değiştirildi:", aktifOyunModu);
            aktiviteGuncelle(); // Sayaç
        }
    });

    // --- YENİ: CHAT MESAJI DİNLEYİCİSİ ---
    socket.on('chatMesaji', (mesajMetni) => {
        const gonderenKoltuk = oyuncular[socket.id];
        if (gonderenKoltuk !== undefined && mesajMetni && mesajMetni.trim().length > 0) {
            // Güvenlik: HTML taglerini temizle (basitçe)
            const temizMesaj = mesajMetni.replace(/</g, "&lt;").replace(/>/g, "&gt;").substring(0, 100);
            
            io.emit('chatMesajiYayinla', {
                koltukNo: gonderenKoltuk,
                mesaj: temizMesaj
            });
            aktiviteGuncelle(); // Chat yazmak da aktivitedir, süreyi sıfırla
        }
    });
    // -------------------------------------

    socket.on('koltukSec', (data) => {
        const istenenKoltukIndex = data.koltukIndex;
        let oyuncuIsmi = data.isim || `Oyuncu ${istenenKoltukIndex + 1}`; 
        const token = data.token; 

        if (koltuklar[istenenKoltukIndex] === null) {
            koltuklar[istenenKoltukIndex] = socket.id;
            koltukTokenleri[istenenKoltukIndex] = token; 
            oyuncuIsimleri[istenenKoltukIndex] = oyuncuIsmi; 
            oyuncular[socket.id] = istenenKoltukIndex;

            socket.emit('koltukAtandi', { koltukNo: istenenKoltukIndex });
            io.emit('masaDurumu', { koltuklar: koltuklar, isimler: oyuncuIsimleri });
            
            socket.emit('skorGuncelle', oyuncuSkorlari);
            socket.emit('siraGuncelle', sira); 
            socket.emit('kartSayilariGuncelle', kartSayilari);
            socket.emit('yerdekiKartlariGuncelle', yerdekiKartlar);

            aktiviteGuncelle(); // Sayaç

            if (!koltuklar.includes(null) && !oyunBasladi) {
                console.log("4 Kişi tamam, oyun başlıyor!");
                oyunBasladi = true; 
                oyunuBaslatGenel(); 
            }
        }
    });

    socket.on('masadanAyril', () => {
        const k = oyuncular[socket.id];
        if (k !== undefined) {
            console.log(`Oyuncu ${k} ÇIKIŞ BUTONUNA BASTI.`);
            
            koltuklar[k] = null;
            koltukTokenleri[k] = null; 
            oyuncuIsimleri[k] = null;
            delete oyuncular[socket.id];

            io.emit('masaDurumu', { koltuklar: koltuklar, isimler: oyuncuIsimleri });

            if (oyunBasladi) {
                oyunuKompleSifirla(); 
                io.emit('yerdekiYazi', "OYUNCU AYRILDI - OYUN SIFIRLANDI");
            }
            aktiviteGuncelle(); // Sayaç
        }
    });

    socket.on('ilkSiraIste', () => {
        if (oyunBasladi && sira === -1) {
            const isteyenKoltuk = oyuncular[socket.id];
            sira = isteyenKoltuk; 
            io.emit('siraGuncelle', sira); 
            aktiviteGuncelle(); // Sayaç
        }
    });

    socket.on('ilkSiraIptal', () => {
        const isteyenKoltuk = oyuncular[socket.id];
        if (sira === isteyenKoltuk) {
            sira = -1; 
            io.emit('siraGuncelle', sira);
            aktiviteGuncelle(); // Sayaç
        }
    });

    socket.on('kartOyna', (data) => {
        const atanKoltuk = oyuncular[socket.id];
        if (atanKoltuk !== sira) return; 

        sonToplamaYedegi = null; 
        io.emit('ortayiGeriKoyButonuGizle'); 

        yerdekiKartlar.push({ kart: data.kart, oynayanKoltuk: atanKoltuk });

        if (oyuncuElleri[atanKoltuk]) {
            oyuncuElleri[atanKoltuk] = oyuncuElleri[atanKoltuk].filter(k => 
                !(k.sembol === data.kart.sembol && k.deger === data.kart.deger)
            );
        }

        if (kartSayilari[atanKoltuk] > 0) kartSayilari[atanKoltuk]--;

        sira = (sira + 1) % 4;
        io.emit('biriKartAtti', { kart: data.kart, koltukNo: atanKoltuk });
        io.emit('siraGuncelle', sira);
        io.emit('kartSayilariGuncelle', kartSayilari);
        aktiviteGuncelle(); // Sayaç
    });

    socket.on('kartGeriAl', () => {
        const geriAlanKoltuk = oyuncular[socket.id];
        yerdekiKartlar.pop();

        sira = geriAlanKoltuk;
        kartSayilari[geriAlanKoltuk]++;
        io.emit('kartGeriAlindi', { koltukNo: geriAlanKoltuk });
        io.emit('siraGuncelle', sira);
        io.emit('kartSayilariGuncelle', kartSayilari);
        aktiviteGuncelle(); // Sayaç
    });

    socket.on('ortayiTopla', () => {
        const toplayanKoltuk = oyuncular[socket.id];
        
        sonToplamaYedegi = {
            yerdekiKartlar: JSON.parse(JSON.stringify(yerdekiKartlar)), 
            toplayanKoltuk: toplayanKoltuk,
            sira: sira, 
            kartSayisi: yerdekiKartlar.length 
        };

        const sadeceKartlar = yerdekiKartlar.map(x => x.kart);
        oyuncuToplananKartlar[toplayanKoltuk].push(...sadeceKartlar);
        
        yerdekiKartlar = [];
        
        oyuncuSkorlari[toplayanKoltuk]++;
        sira = toplayanKoltuk; 

        io.emit('masaTemizlendi', { 
            toplayanKoltuk: toplayanKoltuk,
            yeniSkorlar: oyuncuSkorlari
        });
        io.emit('siraGuncelle', sira); 
        aktiviteGuncelle(); // Sayaç

        const toplamKart = kartSayilari.reduce((a, b) => a + b, 0);
        if (toplamKart === 0) {
            oyunuBitir();
        }
    });

    socket.on('ortayiGeriKoy', () => {
        const isteyenKoltuk = oyuncular[socket.id]; 

        if (sonToplamaYedegi && sonToplamaYedegi.toplayanKoltuk === isteyenKoltuk) {
            console.log(`Oyuncu ${isteyenKoltuk} ortayı geri koyuyor...`); 

            yerdekiKartlar = sonToplamaYedegi.yerdekiKartlar;
            
            const silinecekAdet = sonToplamaYedegi.kartSayisi;
            const toplamAdet = oyuncuToplananKartlar[isteyenKoltuk].length;
            oyuncuToplananKartlar[isteyenKoltuk].splice(toplamAdet - silinecekAdet, silinecekAdet);

            oyuncuSkorlari[isteyenKoltuk]--; 

            sira = sonToplamaYedegi.sira;
            sonToplamaYedegi = null;

            io.emit('yerdekiKartlariGuncelle', yerdekiKartlar);
            io.emit('skorGuncelle', oyuncuSkorlari);
            io.emit('siraGuncelle', sira);
            
            io.emit('ortayiGeriKoyButonuGizle'); 
            aktiviteGuncelle(); // Sayaç
        }
    });

    socket.on('yeniElDagit', () => {
        console.log("Yeni el dağıt isteği geldi.");
        oyunBasladi = true; 
        oyunuBaslatGenel(); 
    });

    socket.on('disconnect', () => {
        const k = oyuncular[socket.id];
        if (k !== undefined) {
            console.log(`Oyuncu ${k} bağlantısı koptu (F5 veya İnternet).`);
            
            delete oyuncular[socket.id];

            if (!oyunBasladi) {
                koltuklar[k] = null; 
                // Token kalsın
                io.emit('masaDurumu', { koltuklar: koltuklar, isimler: oyuncuIsimleri });
            }
            // Oyun başladıysa koltuğu SİLMİYORUZ.
            aktiviteGuncelle(); // Sayaç
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => { console.log(`Sunucu çalışıyor: Port ${PORT}`); });