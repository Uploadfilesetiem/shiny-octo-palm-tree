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

// --- PERBAIKAN: MENGGUNAKAN FUNGSI STANDAR CHALK ---
const horror = (text) => chalk.red(text);
const neon = (text) => chalk.green(text);
const cyber = (text) => chalk.cyan(text);
const warn = (text) => chalk.yellow(text);

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
    >> SLCODE PROTOCOL ACTIVATED - PREFIX: .r <<
    `));

    if (!sock.authState.creds.registered) {
        console.log(cyber("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        const phoneNumber = await question(neon('Enter Number (628xxx): '));
        const code = await sock.requestPairingCode(phoneNumber.trim());
        console.log(cyber("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        console.log(warn(`\n[!] ACCESS CODE: `) + chalk.white.bgRed.bold(` ${code} `));
        console.log(cyber("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        
        const remoteJid = m.key.remoteJid;
        const pushName = m.pushName || "User";
        const body = (m.message.conversation || m.message.extendedTextMessage?.text || "").toLowerCase().trim();

        // LOG KONSOL SEDERHANA (PASTI JALAN)
        console.log(chalk.blue(`[${new Date().toLocaleTimeString()}] `) + chalk.green(`SIGNAL: `) + chalk.white(`${pushName} -> `) + chalk.yellow(body));

        await sock.readMessages([m.key]);

        if (body === '.r') {
            const quotedMsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMsg) return sock.sendMessage(remoteJid, { text: "❌ Reply target with *.r*" }, { quoted: m });

            const viewOnce = quotedMsg.viewOnceMessageV2 || quotedMsg.viewOnceMessage || quotedMsg.viewOnceMessageV2Extension;
            const actualMessage = viewOnce ? viewOnce.message : quotedMsg;
            const mediaType = Object.keys(actualMessage)[0];

            if (viewOnce || mediaType === 'imageMessage' || mediaType === 'videoMessage') {
                const media = actualMessage[mediaType];
                try {
                    console.log(horror(`[!] BYPASSING: `) + cyber(remoteJid));
                    const stream = await downloadContentFromMessage(media, mediaType.replace('Message', ''));
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) {
                        buffer = Buffer.concat([buffer, chunk]);
                    }

                    const resultText = `*BYPASS SUCCESSFUL*\n_Media extracted._`;
                    
                    if (mediaType === 'imageMessage') {
                        await sock.sendMessage(remoteJid, { image: buffer, caption: resultText }, { quoted: m });
                    } else if (mediaType === 'videoMessage') {
                        await sock.sendMessage(remoteJid, { video: buffer, caption: resultText }, { quoted: m });
                    }
                    console.log(neon(`[✔] SUCCESS!`));
                } catch (e) {
                    console.log(horror(`[✘] ERROR!`));
                    await sock.sendMessage(remoteJid, { text: "⚠️ Error extracting media." }, { quoted: m });
                }
            }
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            console.log(chalk.red(`\n[!] CONNECTION LOST. RECONNECTING...`));
            if (reason !== DisconnectReason.loggedOut) startBot();
        } else if (connection === 'open') {
            console.log(chalk.green(`\n[⚡] SLCODE ONLINE. USE .r TO BYPASS.\n`));
        }
    });
}

startBot().catch(err => console.log(chalk.red("CRITICAL: ") + err));
