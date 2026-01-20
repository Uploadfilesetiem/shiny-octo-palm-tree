const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    downloadContentFromMessage,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const { Boom } = require('@hapi/boom');
const chalk = require('chalk');

/**
 * SLCODE PROTOCOL - FIXED VERSION
 * Fitur: Bypass RVO (.r)
 * Status Auto-Read: OFF (Centang biru mati)
 */

// Perbaikan fungsi warna agar tidak TypeError
const horror = (text) => chalk.red ? chalk.red.bold(text) : text;
const neon = (text) => chalk.green ? chalk.green(text) : text;
const cyber = (text) => chalk.cyan ? chalk.cyan.bold(text) : text;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_data');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false, 
        browser: ["Windows", "Chrome", "1.0.0"]
    });

    console.clear();
    console.log(horror(`
    ███████╗██╗     ██████╗ ██████╗ ██████╗ ███████╗
    ██╔════╝██║    ██╔════╝██╔═══██╗██╔══██╗██╔════╝
    ███████╗██║    ██║     ██║   ██║██║  ██║█████╗  
    ╚════██║██║    ██║     ██║   ██║██║  ██║██╔══╝  
    ███████║███████╗╚██████╗╚██████╔╝██████╔╝███████╗
    ╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
    >> SLCODE PROTOCOL - NO AUTO READ - PREFIX: .r <<
    `));

    // Proses Pairing jika belum tertaut
    if (!sock.authState.creds.registered) {
        console.log(cyber("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        const phoneNumber = await question(neon('Masukkan Nomor WA (contoh 628xxx): '));
        const code = await sock.requestPairingCode(phoneNumber.trim());
        console.log(cyber("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        console.log(chalk.yellow(`\n[!] SLCODE ACCESS CODE: `) + chalk.white.bgRed.bold(` ${code} `));
        console.log(cyber("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        
        const remoteJid = m.key.remoteJid;
        const pushName = m.pushName || "User";
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").toLowerCase().trim();

        // Tampilkan log pesan masuk di terminal
        console.log(chalk.gray(`[${new Date().toLocaleTimeString()}] `) + neon(`SIGNAL: `) + chalk.white(`${pushName} -> `) + chalk.yellow(body));

        // --- FITUR AUTO READ DINONAKTIFKAN ---
        // await sock.readMessages([m.key]); // Baris ini sengaja dihilangkan

        if (body === '.r') {
            const quotedMsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg) return sock.sendMessage(remoteJid, { text: "❌ Balas (Reply) pesan Sekali Lihat dengan *.r*" }, { quoted: m });

            const viewOnce = quotedMsg.viewOnceMessageV2 || quotedMsg.viewOnceMessage || quotedMsg.viewOnceMessageV2Extension;
            const actualMessage = viewOnce ? viewOnce.message : quotedMsg;
            const mediaType = Object.keys(actualMessage)[0];

            if (viewOnce || mediaType === 'imageMessage' || mediaType === 'videoMessage') {
                const media = actualMessage[mediaType];
                try {
                    console.log(horror(`[!] EXTRACTING MEDIA FROM: `) + cyber(remoteJid));
                    const stream = await downloadContentFromMessage(media, mediaType.replace('Message', ''));
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) {
                        buffer = Buffer.concat([buffer, chunk]);
                    }

                    const resultCaption = `*BYPASS SUCCESSFUL BY SLCODE*`;
                    
                    if (mediaType === 'imageMessage') {
                        await sock.sendMessage(remoteJid, { image: buffer, caption: resultCaption }, { quoted: m });
                    } else if (mediaType === 'videoMessage') {
                        await sock.sendMessage(remoteJid, { video: buffer, caption: resultCaption }, { quoted: m });
                    }
                    console.log(neon(`[✔] MEDIA Berhasil Terkirim!`));
                } catch (e) {
                    console.log(horror(`[✘] Gagal Mengambil Media: ` + e.message));
                }
            }
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            console.log(horror(`\n[!] KONEKSI TERPUTUS. RECONNECTING...`));
            if (reason !== DisconnectReason.loggedOut) startBot();
        } else if (connection === 'open') {
            console.log(neon(`\n[⚡] SLCODE PROTOCOL ONLINE. AUTO-READ: OFF.\n`));
        }
    });
}

startBot().catch(err => console.log(chalk.red("CRITICAL ERROR: ") + err));
