const socket = io(); 

const sembolIsimleri = { '♥': 'kupa', '♠': 'maca', '♦': 'karo', '♣': 'sinek' };
const kartDuzenleri = {
    '2': [0, 2, 0], '3': [0, 3, 0], '4': [2, 0, 2], '5': [2, 1, 2],
    '6': [3, 0, 3], '7': [3, 1, 3], '8': [3, 2, 3], '9': [4, 1, 4], '10': [4, 2, 4]
};

let benimKoltukNo = -1; 
let yerdekiKartlar = [];
let benimElim = []; 
let yerelSkorlar = [0, 0, 0, 0]; 
let suankiSira = -1; 
let globalKartSayilari = [0, 0, 0, 0];
let globalIsimler = [null, null, null, null];
let oyunBittiModu = false; 
let globalToplananKartlar = [[], [], [], []]; 

// --- ÇIKIŞ YAP FONKSİYONU ---
function cikisYap() {
    if(confirm("Masadan kalkıp çıkış yapmak istiyor musunuz? (Oyun sıfırlanabilir)")) {
        sessionStorage.removeItem('oyuncuToken');
        socket.emit('masadanAyril');
        location.reload();
    }
}
// ---------------------------------

function oyunModuDegistir(yeniMod) {
    socket.emit('oyunModuDegisti', yeniMod);
}

socket.on('oyunModuGuncelle', (gelenMod) => {
    const selectKutusu = document.getElementById('oyun-modu-select');
    if (selectKutusu) {
        selectKutusu.value = gelenMod;
    }
});

socket.on('connect', () => {
    let kayitliToken = sessionStorage.getItem('oyuncuToken');
    if (kayitliToken) {
        socket.emit('tekrarBaglan', kayitliToken);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const btnSeat = document.getElementById('btn-seat-select');
    if(btnSeat) {
        btnSeat.textContent = "Masadan Ayrıl"; 
        btnSeat.addEventListener('click', () => { 
            cikisYap(); 
        });
    }

    const btnRedeal = document.getElementById('btn-redeal');
    if(btnRedeal) {
        btnRedeal.addEventListener('click', () => {
            const modal = document.getElementById('game-result-modal');
            if(modal) modal.classList.add('hidden');
            socket.emit('yeniElDagit'); 
        });
    }

    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                chatMesajGonder();
            }
        });
    }

    // Scroll Kontrolü: Kullanıcı en aşağı inerse bildirimi temizle
    const messagesDiv = document.getElementById('chat-messages');
    if(messagesDiv) {
        messagesDiv.addEventListener('scroll', () => {
            const isAtBottom = messagesDiv.scrollHeight - messagesDiv.clientHeight <= messagesDiv.scrollTop + 5;
            if (isAtBottom) {
                const chatBox = document.getElementById('chat-box');
                chatBox.classList.remove('notification-pulse');
            }
        });
    }
});

function koltukSec(koltukIndex) {
    const isimInput = document.getElementById('oyuncu-isim-input');
    let isim = isimInput.value.trim();
    if(isim === "") isim = `Oyuncu ${koltukIndex+1}`; 
    
    let token = sessionStorage.getItem('oyuncuToken');
    if (!token) {
        token = 'oyuncu_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('oyuncuToken', token);
    }
    
    socket.emit('koltukSec', { koltukIndex: koltukIndex, isim: isim, token: token });
}

function ortayiGeriKoy() { socket.emit('ortayiGeriKoy'); }

// --- YENİ: CHAT SİSTEMİ FONKSİYONLARI ---

function bildirimTemizle() {
    const chatBox = document.getElementById('chat-box');
    chatBox.classList.remove('notification-pulse');
}

function chatMinimize(event) {
    event.stopPropagation(); 
    const chatBox = document.getElementById('chat-box');
    chatBox.classList.add('chat-hidden');
    chatBox.classList.remove('chat-expanded');
    chatBox.classList.remove('chat-minimized');
}

function chatToggle(event) {
    if(event) event.stopPropagation();
    const chatBox = document.getElementById('chat-box');
    const toggleBtn = document.getElementById('chat-toggle-btn');
    
    bildirimTemizle();

    if (chatBox.classList.contains('chat-hidden')) {
        chatBox.classList.remove('chat-hidden');
        chatBox.classList.add('chat-minimized');
        return;
    }

    chatBox.classList.toggle('chat-expanded');
    chatBox.classList.toggle('chat-minimized');

    if (chatBox.classList.contains('chat-expanded')) {
        toggleBtn.innerText = "⤡"; 
        document.getElementById('chat-input').focus();
    } else {
        toggleBtn.innerText = "⤢"; 
    }
}

function chatBaslikTiklama() {
    const chatBox = document.getElementById('chat-box');
    if (chatBox.classList.contains('chat-hidden')) {
        chatBox.classList.remove('chat-hidden');
        chatBox.classList.add('chat-minimized');
        bildirimTemizle(); 
    }
}

function chatMesajGonder() {
    const chatInput = document.getElementById('chat-input');
    const mesaj = chatInput.value;
    
    if (mesaj.trim() !== "") {
        socket.emit('chatMesaji', mesaj);
        chatInput.value = "";
    }
}

socket.on('chatMesajiYayinla', (data) => {
    const messagesDiv = document.getElementById('chat-messages');
    const chatBox = document.getElementById('chat-box');

    const msgElement = document.createElement('div');
    msgElement.className = 'chat-msg';
    
    let gonderenIsim = "";
    let renk = "#ecf0f1"; 

    if (benimKoltukNo === -1) {
        const harita = { 0: 'Güney', 1: 'Batı', 2: 'Kuzey', 3: 'Doğu' };
        gonderenIsim = globalIsimler[data.koltukNo] || harita[data.koltukNo];
    } else {
        const yon = konumBul(data.koltukNo);
        if (yon === 'guney') { gonderenIsim = "SEN"; renk = "#3498db"; }
        else if (yon === 'kuzey') { gonderenIsim = "KUZEY"; renk = "#e74c3c"; }
        else if (yon === 'bati') { gonderenIsim = "BATI"; renk = "#f1c40f"; }
        else if (yon === 'dogu') { gonderenIsim = "DOĞU"; renk = "#2ecc71"; }
        
        if (globalIsimler[data.koltukNo]) {
            gonderenIsim = `${gonderenIsim} (${globalIsimler[data.koltukNo]})`;
        }
    }

    msgElement.innerHTML = `<span class="sender" style="color:${renk}">${gonderenIsim}:</span> ${data.mesaj}`;
    
    // Scroll Durumu Kontrolü (Mesaj eklenmeden önce)
    const isScrolledToBottom = messagesDiv.scrollHeight - messagesDiv.clientHeight <= messagesDiv.scrollTop + 5;
    
    messagesDiv.appendChild(msgElement);

    // KENDİSİ DEĞİLSE BİLDİRİM VER
    // Eğer mesajı atan ben değilsem ve (chat kapalıysa VEYA chat açık ama ben yukarıdaysam)
    if (data.koltukNo !== benimKoltukNo) {
        if (chatBox.classList.contains('chat-hidden') || !isScrolledToBottom) {
            chatBox.classList.add('notification-pulse');
        }
    }

    if (isScrolledToBottom) {
        // En alttaysa otomatik kaydır (Ben yazdıysam veya aşağıdaysam)
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } 
    // Eğer ben yazdıysam her türlü aşağı kaydır
    else if (data.koltukNo === benimKoltukNo) {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
});
// ----------------------------------------

socket.on('masaDurumu', (data) => {
    const koltuklar = data.koltuklar;
    const isimler = data.isimler;
    globalIsimler = isimler; 

    const harita = { 0: 'guney', 1: 'bati', 2: 'kuzey', 3: 'dogu' };
    
    koltuklar.forEach((socketId, index) => {
        const btnId = `btn-sec-${harita[index]}`;
        const btn = document.getElementById(btnId);
        
        if (socketId !== null) {
            const oyuncuIsmi = isimler[index] || "DOLU";
            btn.classList.remove('koltuk-bos');
            btn.classList.add('koltuk-dolu');
            btn.innerHTML = `<span>${oyuncuIsmi}</span><br><span style='font-size:10px'>(DOLU)</span>`;
            btn.disabled = true;
        } else {
            btn.classList.remove('koltuk-dolu');
            btn.classList.add('koltuk-bos');
            btn.innerText = harita[index].toUpperCase();
            btn.disabled = false;
        }
    });

    if (benimKoltukNo !== -1) {
        isimEtiketleriniGuncelle();
    }
});

function isimEtiketleriniGuncelle() {
    for(let i=0; i<4; i++) {
        const yon = konumBul(i); 
        const etiket = document.getElementById(yon + '-isim');
        if (etiket) {
            if (globalIsimler[i]) {
                etiket.innerText = globalIsimler[i];
            } else {
                etiket.innerText = yon.toUpperCase();
            }
        }
    }
}

function konumBul(hedefKoltuk) {
    let fark = (hedefKoltuk - benimKoltukNo + 4) % 4;
    if (fark === 0) return 'guney';
    if (fark === 1) return 'bati';
    if (fark === 2) return 'kuzey';
    if (fark === 3) return 'dogu';
}

socket.on('koltukAtandi', (data) => {
    benimKoltukNo = data.koltukNo;
    document.getElementById('secim-ekrani').style.display = 'none';
    document.querySelector('.yerdeki-yazi').innerText = "Diğer oyuncular bekleniyor...";
    isimEtiketleriniGuncelle();
});

socket.on('elDagitildi', (gelenEl) => {
    benimElim = gelenEl;
    kartlariSirala(benimElim); 
    oyunBittiModu = false; 
    globalToplananKartlar = [[], [], [], []];
    
    const modal = document.getElementById('game-result-modal');
    if(modal) modal.classList.add('hidden');
    
    const btnGeriKoy = document.getElementById('btn-ortayi-geri');
    if(btnGeriKoy) btnGeriKoy.style.display = 'none';

    if(yerdekiKartlar.length === 0 && yerelSkorlar.reduce((a,b)=>a+b,0) === 0) {
        document.querySelector('.yerdeki-yazi').innerText = "Oyun Başladı! Kim başlayacak?";
    }
    arayuzuGuncelle();
});

socket.on('yerdekiKartlariGuncelle', (gelenKartlar) => {
    yerdekiKartlar = gelenKartlar;
    arayuzuGuncelle();
});

socket.on('siraGuncelle', (siraNo) => {
    suankiSira = siraNo;
    arayuzuGuncelle(); 
});

socket.on('kartSayilariGuncelle', (yeniSayilar) => {
    globalKartSayilari = yeniSayilar;
    arayuzuGuncelle();
});

socket.on('biriKartAtti', (data) => {
    yerdekiKartlar.push({ kart: data.kart, oynayanKoltuk: data.koltukNo });
    if (data.koltukNo === benimKoltukNo) {
        benimElim = benimElim.filter(k => !(k.sembol === data.kart.sembol && k.deger === data.kart.deger));
    } 
    const btnGeriKoy = document.getElementById('btn-ortayi-geri');
    if(btnGeriKoy) btnGeriKoy.style.display = 'none';
    arayuzuGuncelle();
});

socket.on('kartGeriAlindi', (data) => {
    const geriAlinanKartIndex = yerdekiKartlar.findIndex(x => x.oynayanKoltuk === data.koltukNo);
    if (geriAlinanKartIndex !== -1) {
        const geriAlinanVeri = yerdekiKartlar[geriAlinanKartIndex];
        yerdekiKartlar.splice(geriAlinanKartIndex, 1);
        if (data.koltukNo === benimKoltukNo) {
            benimElim.push(geriAlinanVeri.kart);
            kartlariSirala(benimElim);
        }
    }
    arayuzuGuncelle();
});

socket.on('masaTemizlendi', (data) => {
    if (data.toplayanKoltuk !== -1) {
        const toplananKartlar = yerdekiKartlar.map(veri => veri.kart);
        globalToplananKartlar[data.toplayanKoltuk].push(...toplananKartlar);
    }

    yerdekiKartlar = [];
    if (data.toplayanKoltuk !== -1) {
        yerelSkorlar[data.toplayanKoltuk]++;
        let kim = konumBul(data.toplayanKoltuk).toUpperCase();
        if(kim === 'GUNEY') kim = "SEN";
        document.querySelector('.yerdeki-yazi').innerText = `${kim} TOPLADI!`;

        if(data.toplayanKoltuk === benimKoltukNo) {
            const btnGeriKoy = document.getElementById('btn-ortayi-geri');
            if(btnGeriKoy) btnGeriKoy.style.display = 'block';
        } else {
             const btnGeriKoy = document.getElementById('btn-ortayi-geri');
             if(btnGeriKoy) btnGeriKoy.style.display = 'none';
        }

    } else {
        yerelSkorlar = data.yeniSkorlar; 
    }
    arayuzuGuncelle();
});

socket.on('ortayiGeriKoyButonuGizle', () => {
    const btnGeriKoy = document.getElementById('btn-ortayi-geri');
    if(btnGeriKoy) btnGeriKoy.style.display = 'none';
});

socket.on('oyunBitti', (data) => {
    oyunBittiModu = true;
    document.querySelector('.yerdeki-yazi').innerText = "EL BİTTİ!";
    arayuzuGuncelle();
    
    if(data && data.toplananKartlar) {
        globalToplananKartlar = data.toplananKartlar;
    }
    
    oyunSonuEkraniniGoster();
});

socket.on('oyuncuAyrildi', () => {
    // Masa durumu zaten güncelleniyor
});
socket.on('yerdekiYazi', (msg) => {
    document.querySelector('.yerdeki-yazi').innerText = msg;
});

socket.on('skorGuncelle', (skorlar) => {
    yerelSkorlar = skorlar;
    arayuzuGuncelle();
});

socket.on('zamanAsimiOldu', () => {
    alert("Masada uzun süre hareket olmadığı için oyun sonlandırıldı.");
    sessionStorage.removeItem('oyuncuToken'); 
    location.reload(); 
});

function oyunSonuEkraniniGoster() {
    const modal = document.getElementById('game-result-modal');
    const container = document.getElementById('collected-cards-container');
    
    if(!modal || !container) return; 

    container.innerHTML = ''; 

    for(let i=0; i<4; i++) {
        if(globalIsimler[i]) {
            const row = document.createElement('div');
            row.className = 'player-result-box'; 

            const nameTitle = document.createElement('h3');
            nameTitle.textContent = `${globalIsimler[i]} (Toplam: ${globalToplananKartlar[i].length} Kart)`;
            nameTitle.style.margin = "0 0 10px 0";
            nameTitle.style.fontSize = "16px";
            nameTitle.style.color = "#f1c40f";
            row.appendChild(nameTitle);

            const grid = document.createElement('div');
            grid.style.display = "flex";
            grid.style.flexWrap = "wrap";
            grid.style.gap = "5px";

            globalToplananKartlar[i].forEach(kart => {
                const cardDiv = document.createElement('div');
                cardDiv.className = 'mini-card'; 
                
                if(kart.sembol === '♥' || kart.sembol === '♦') {
                    cardDiv.style.color = "#c0392b";
                } else {
                    cardDiv.style.color = "#2c3e50";
                }
                
                cardDiv.textContent = `${kart.deger}${kart.sembol}`;
                grid.appendChild(cardDiv);
            });

            if(globalToplananKartlar[i].length === 0) {
                const emptyMsg = document.createElement('span');
                emptyMsg.textContent = "Hiç kart toplayamadı.";
                emptyMsg.style.fontSize = "12px";
                emptyMsg.style.fontStyle = "italic";
                grid.appendChild(emptyMsg);
            }

            row.appendChild(grid);
            container.appendChild(row);
        }
    }

    modal.classList.remove('hidden');
}

function arayuzuGuncelle() {
    masayiCiz();
    rakipleriCiz(); 
    yerdekileriCiz();
    skorlariCiz();
    butonKontrol();
    siraGostergesiGuncelle();
}

function butonKontrol() {
    const btnGeri = document.getElementById('btn-geri');
    const btnIlkSira = document.getElementById('btn-ilk-sira');
    const btnVazgec = document.getElementById('btn-ilk-sira-iptal');
    const btnDagit = document.getElementById('btn-dagit');
    const btnTopla = document.getElementById('btn-topla'); 
    
    const yerdeKartimVar = yerdekiKartlar.some(x => x.oynayanKoltuk === benimKoltukNo);
    const toplamSkor = yerelSkorlar.reduce((a, b) => a + b, 0);

    // 1. Geri Al
    btnGeri.style.display = yerdeKartimVar ? "block" : "none";

    // 2. Başla / Vazgeç
    if (suankiSira === -1 && benimElim.length > 0 && toplamSkor === 0) {
        btnIlkSira.style.display = "block";
        btnVazgec.style.display = "none";
    } 
    else if (suankiSira === benimKoltukNo && yerdekiKartlar.length === 0 && !yerdeKartimVar && benimElim.length > 0 && toplamSkor === 0) {
        btnIlkSira.style.display = "none";
        btnVazgec.style.display = "block";
    } 
    else {
        btnIlkSira.style.display = "none";
        btnVazgec.style.display = "none";
    }

    btnDagit.style.display = "none"; 

    // 4. Ortayı Topla
    if (yerdekiKartlar.length === 4) {
        btnTopla.classList.remove('btn-pasif');
        btnTopla.style.backgroundColor = "#e67e22"; 
    } else {
        btnTopla.classList.add('btn-pasif');
        btnTopla.style.backgroundColor = "#95a5a6"; 
    }
}

function siraGostergesiGuncelle() {
    ['guney', 'bati', 'kuzey', 'dogu'].forEach(yon => {
        document.getElementById(yon + '-eli').classList.remove('aktif-sira', 'pasif-sira');
    });

    if (suankiSira === -1 || yerdekiKartlar.length === 4) return; 

    const aktifYon = konumBul(suankiSira);
    const aktifEl = document.getElementById(aktifYon + '-eli');
    if (aktifEl) {
        aktifEl.classList.add('aktif-sira');
    }
}

function masayiCiz() {
    const container = document.getElementById('guney-eli');
    container.innerHTML = ""; 
    const yerdeKartimVar = yerdekiKartlar.some(x => x.oynayanKoltuk === benimKoltukNo);
    const siraBende = (suankiSira === benimKoltukNo);

    benimElim.forEach((kart) => {
        const tiklanabilir = !yerdeKartimVar && siraBende;
        
        const kartEl = kartElementiOlustur(kart, true, tiklanabilir);
        if (!tiklanabilir) {
            kartEl.style.cursor = "not-allowed";
            kartEl.classList.add("tiklanamaz");
        }
        container.appendChild(kartEl);
    });
}

function rakipleriCiz() {
    for (let koltukNo = 0; koltukNo < 4; koltukNo++) {
        if (koltukNo !== benimKoltukNo) {
            const yon = konumBul(koltukNo);
            const container = document.getElementById(yon + '-eli');
            container.innerHTML = "";
            const adet = globalKartSayilari[koltukNo];
            for(let i=0; i<adet; i++) {
                container.appendChild(kartElementiOlustur(null, false, false));
            }
        }
    }
}

function skorlariCiz() {
    yerelSkorlar.forEach((puan, koltukIndex) => {
        const yon = konumBul(koltukIndex);
        const container = document.getElementById(yon + '-toplanan');
        container.innerHTML = ""; 
        for (let i = 0; i < puan; i++) {
            const paket = document.createElement("div");
            paket.className = "trick-paket";
            if (i % 2 !== 0) paket.classList.add("yatik"); 
            container.appendChild(paket);
        }
    });
}

function yerdekileriCiz() {
    const ortaAlan = document.getElementById('oyun-alani');
    const btnDagit = document.getElementById('btn-dagit');
    
    let eskiYazi = document.querySelector('.yerdeki-yazi')?.innerText || "";
    let icerik = `<div class="yerdeki-yazi">${eskiYazi}</div>`;
    
    ortaAlan.innerHTML = icerik;
    ortaAlan.appendChild(btnDagit);

    yerdekiKartlar.forEach((veri) => {
        const kartEl = kartElementiOlustur(veri.kart, true, false);
        kartEl.classList.add('atilan-kart');
        const yon = konumBul(veri.oynayanKoltuk);
        switch (yon) {
            case 'guney': kartEl.style.bottom = "10px"; kartEl.style.left = "50%"; kartEl.style.transform = "translateX(-50%)"; break;
            case 'kuzey': kartEl.style.top = "10px"; kartEl.style.left = "50%"; kartEl.style.transform = "translateX(-50%)"; break;
            case 'bati': kartEl.style.left = "10px"; kartEl.style.top = "50%"; kartEl.style.transform = "translateY(-50%) rotate(90deg)"; break;
            case 'dogu': kartEl.style.right = "10px"; kartEl.style.top = "50%"; kartEl.style.transform = "translateY(-50%) rotate(-90deg)"; break;
        }
        ortaAlan.appendChild(kartEl);
    });
}

function kartlariSirala(el) {
    const siraliSemboller = ['♠', '♦', '♣', '♥']; 
    const siraliDegerler = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

    el.sort((a, b) => {
        let sembolFarki = siraliSemboller.indexOf(a.sembol) - siraliSemboller.indexOf(b.sembol);
        if (sembolFarki !== 0) return sembolFarki;
        return siraliDegerler.indexOf(a.deger) - siraliDegerler.indexOf(b.deger);
    });
}

function kartTiklandi(kartObjesi) { socket.emit('kartOyna', { kart: kartObjesi }); }
function ortayiTopla() { socket.emit('ortayiTopla'); }
function kartGeriAl() { socket.emit('kartGeriAl'); }
function ilkSiraIste() { socket.emit('ilkSiraIste'); }
function ilkSiraIptal() { socket.emit('ilkSiraIptal'); }
function yeniElDagit() { socket.emit('yeniElDagit'); }

function kartElementiOlustur(kartObjesi, acikMi, tiklanabilir) {
    const kartDiv = document.createElement("div");
    kartDiv.className = "kart";
    if (!acikMi) { kartDiv.classList.add("kapali"); return kartDiv; }

    const sembol = kartObjesi.sembol;
    const deger = kartObjesi.deger;
    const renk = (sembol === '♥' || sembol === '♦') ? "#d40000" : "#2d2d2d";
    kartDiv.style.color = renk;
    kartDiv.innerHTML = `<div class="kose-ust"><div>${deger}</div><div>${sembol}</div></div><div class="orta"></div><div class="kose-alt"><div>${deger}</div><div>${sembol}</div></div>`;

    const ortaKisim = kartDiv.querySelector('.orta');
    if (['J', 'Q', 'K'].includes(deger)) {
        ortaKisim.style.display = "flex";
        const cerceve = document.createElement("div"); cerceve.className = "resim-cercevesi"; cerceve.style.borderColor = renk;
        const dosyaIsmi = `${deger.toLowerCase()}-${sembolIsimleri[sembol]}.svg`;
        const resim = document.createElement("img"); resim.src = `img/${dosyaIsmi}`;
        resim.onerror = () => { cerceve.innerText = deger; cerceve.style.fontSize = "60px"; cerceve.style.overflow="visible"; };
        cerceve.appendChild(resim); ortaKisim.appendChild(cerceve);
    } else if (deger === 'A') {
        ortaKisim.style.display = "flex"; ortaKisim.style.justifyContent = "center"; ortaKisim.style.alignItems = "center";
        const buyukSembol = document.createElement("div"); buyukSembol.innerText = sembol; buyukSembol.style.fontSize = "60px";
        ortaKisim.appendChild(buyukSembol);
    } else {
        ortaKisim.style.display = "flex";
        const duzen = kartDuzenleri[deger];
        if (Math.max(...duzen) >= 4) ortaKisim.classList.add("orta-kalabalik");
        createColumn(ortaKisim, duzen[0], sembol); createColumn(ortaKisim, duzen[1], sembol); createColumn(ortaKisim, duzen[2], sembol);
    }
    
    if (tiklanabilir) { 
        kartDiv.addEventListener("click", () => { socket.emit('kartOyna', { kart: kartObjesi }); }); 
        kartDiv.style.cursor = "pointer"; 
    }
    return kartDiv;
}

function createColumn(container, count, symbol) {
    const sutunDiv = document.createElement("div"); sutunDiv.className = "sutun";
    if (count === 1) sutunDiv.classList.add("sutun-orta-tek"); else sutunDiv.classList.add("sutun-yay");
    for (let i = 0; i < count; i++) {
        const sembolDiv = document.createElement("div"); sembolDiv.className = "sembol"; sembolDiv.innerText = symbol;
        if (count > 1 && i >= count / 2) sembolDiv.style.transform = "rotate(180deg)";
        sutunDiv.appendChild(sembolDiv);
    }
    container.appendChild(sutunDiv);
}