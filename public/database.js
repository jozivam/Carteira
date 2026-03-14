/**
 * Módulo de Banco de Dados SQLite para Capacitor
 * Substitui o idb.js antigo por uma estrutura robusta em SQL.
 */

window.database = {
    db: null,
    sqlite: null,

    async init() {
        try {
            // No Capacitor, o plugin fica em window.Capacitor.Plugins
            const { CapacitorSQLite } = window.Capacitor?.Plugins || {};
            if (!CapacitorSQLite) {
                console.warn('CapacitorSQLite não encontrado. Usando localStorage como fallback (Ambiente Web).');
                this.isFallback = true;
                return;
            }

            const sqlite = new window.CapacitorSQLite.SQLiteConnection(CapacitorSQLite);
            this.sqlite = sqlite;

            const ret = await sqlite.checkConnectionsConsistency();
            const isConn = (await sqlite.isConnection("carteira_db", false)).result;
            
            if (ret.result && isConn) {
                this.db = await sqlite.retrieveConnection("carteira_db", false);
            } else {
                this.db = await sqlite.createConnection("carteira_db", false, "no-encryption", 1, false);
            }

            await this.db.open();

            // Criação das tabelas
            const createTables = `
                CREATE TABLE IF NOT EXISTS kv_store (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
                CREATE TABLE IF NOT EXISTS wallets (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    balance REAL,
                    icon TEXT,
                    color TEXT
                );
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY,
                    date TEXT,
                    description TEXT,
                    amount REAL,
                    category TEXT,
                    wallet TEXT,
                    status TEXT,
                    dueDate TEXT,
                    attachment TEXT,
                    attachmentUrl TEXT,
                    recurring INTEGER,
                    recurringType TEXT,
                    currentInstallment INTEGER,
                    totalInstallments INTEGER
                );
            `;
            await this.db.execute(createTables);
            
            // Seed inicial de carteiras se estiver vazio
            const walletsRes = await this.db.query("SELECT count(*) as count FROM wallets");
            if (walletsRes.values[0].count === 0) {
                await this.db.execute(`
                    INSERT INTO wallets (id, name, balance, icon, color) VALUES ('principal', 'Principal', 0.00, 'wallet', '#3b82f6');
                    INSERT INTO wallets (id, name, balance, icon, color) VALUES ('empresa', 'Empresa', 0.00, 'briefcase', '#8b5cf6');
                    INSERT INTO wallets (id, name, balance, icon, color) VALUES ('ticket', 'Ticket Alimentação', 0.00, 'utensils', '#10b981');
                `);
            }
            console.log('SQLite inicializado com sucesso.');
        } catch (err) {
            console.error('Erro ao inicializar SQLite:', err);
            this.isFallback = true;
        }
    },

    // Interface Compatível com o app.js original (get/set/remove)
    // Mas agora salvando em tabelas se a chave for 'transactions' ou 'wallets'
    async get(key) {
        if (this.isFallback) return localStorage.getItem(key);
        if (!this.db) await this.init();

        if (key === 'transactions') {
            const res = await this.db.query("SELECT * FROM transactions ORDER BY date DESC, id DESC");
            return JSON.stringify(res.values);
        }

        if (key === 'wallets') {
            const res = await this.db.query("SELECT * FROM wallets");
            return JSON.stringify(res.values);
        }

        const res = await this.db.query("SELECT value FROM kv_store WHERE key = ?", [key]);
        return res.values.length > 0 ? res.values[0].value : null;
    },

    async set(key, value) {
        if (this.isFallback) {
            localStorage.setItem(key, value);
            return;
        }
        if (!this.db) await this.init();

        if (key === 'transactions') {
            const txs = JSON.parse(value);
            // Sincroniza a tabela com o array (Abordagem simples para manter compatibilidade)
            await this.db.run("DELETE FROM transactions");
            for (const tx of txs) {
                await this.db.run(`
                    INSERT INTO transactions (id, date, description, amount, category, wallet, status, dueDate, attachment, attachmentUrl, recurring, recurringType, currentInstallment, totalInstallments)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [tx.id, tx.date, tx.description, tx.amount, tx.category, tx.wallet, tx.status, tx.dueDate || null, tx.attachment || null, tx.attachmentUrl || null, tx.recurring ? 1 : 0, tx.recurringType || null, tx.currentInstallment || null, tx.totalInstallments || null]);
            }
            return;
        }

        if (key === 'wallets') {
            const wallets = JSON.parse(value);
            await this.db.run("DELETE FROM wallets");
            for (const w of wallets) {
                await this.db.run(`
                    INSERT INTO wallets (id, name, balance, icon, color) VALUES (?, ?, ?, ?, ?)
                `, [w.id, w.name, w.balance, w.icon, w.color]);
            }
            return;
        }

        await this.db.run("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)", [key, value]);
    },

    async remove(key) {
        if (this.isFallback) {
            localStorage.removeItem(key);
            return;
        }
        if (!this.db) await this.init();
        await this.db.run("DELETE FROM kv_store WHERE key = ?", [key]);
    }
};
