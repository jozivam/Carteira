// Antigravity Digital Wallet - App Logic
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzoYAHXynW3Mrvcg5cHbLj6_SiaQcGr-6Uw1Lsluh51iEnGFOZpduVP9XW2fYMJQ4pt/exec';

// Helper: retorna data local no formato YYYY-MM-DD (sem problemas de fuso horário)
function getLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getLocalTime() {
    const now = new Date();
    return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
}

const state = {
    currentScreen: 'dashboard',
    prevScreen: 'dashboard',
    inputState: {
        type: 'expense',
        amount: '0',
        description: '',
        wallet: 'principal',
        category: 'Alimentação',
        paid: true,
        dueDate: getLocalDate(),
        attachment: null
    },
    wallets: [
        { id: 'principal', name: 'Principal', balance: 0.00, icon: 'wallet', color: '#3b82f6' },
        { id: 'empresa', name: 'Empresa', balance: 0.00, icon: 'briefcase', color: '#8b5cf6' },
        { id: 'ticket', name: 'Ticket Alimentação', balance: 0.00, icon: 'utensils', color: '#10b981' }
    ],
    user: { name: 'jozivam', email: 'jozivam@email.com' },
    transactions: [],
    hideBalance: false,
    security: {
        enabled: false,
        pin: '',
        isLocked: true
    },
    loginPinProgress: ''
};

async function initState() {
    try {
        await database.init();
        
        // Verifica se precisamos limpar os dados de teste (executa apenas uma vez)
        const initialized = await database.get('app_initialized_v2');
        if (!initialized) {
            await database.set('transactions', JSON.stringify([]));
            await database.set('wallets', JSON.stringify(state.wallets));
            await database.set('app_initialized_v2', 'true');
        }

        const storedUser = await database.get('user');
        if (storedUser) state.user = JSON.parse(storedUser);
        
        const storedTx = await database.get('transactions');
        if (storedTx) state.transactions = JSON.parse(storedTx);

        const storedWallets = await database.get('wallets');
        if (storedWallets) state.wallets = JSON.parse(storedWallets);

        const storedHide = await database.get('hideBalance');
        if (storedHide !== null) state.hideBalance = storedHide === 'true';

        const storedSecurity = await database.get('security');
        if (storedSecurity) {
            state.security = JSON.parse(storedSecurity);
            state.security.isLocked = true; // Sempre bloqueia ao iniciar
        }
        
        // Verifica se é o primeiro acesso (usuário ainda não se registrou)
        const registered = await database.get('user_registered');
        if (!registered) {
            state.currentScreen = 'register';
            return;
        }

        // Se a segurança estiver ativada, a tela inicial deve ser o login
        if (state.security.enabled) {
            state.currentScreen = 'login';
        }
    } catch (e) {
        console.error('Falha ao inicializar estado:', e);
    }
}

async function saveDraft() {
    try {
        await database.set('tx_draft', JSON.stringify({
            currentScreen: state.currentScreen,
            inputState: state.inputState
        }));
    } catch(e) {
        await database.set('tx_draft', JSON.stringify({
            currentScreen: state.currentScreen,
            inputState: { ...state.inputState, attachmentUrl: null, attachment: null }
        }));
    }
}

async function restoreDraft() {
    try {
        const draftStr = await database.get('tx_draft');
        const draft = draftStr ? JSON.parse(draftStr) : null;
        if (draft && draft.currentScreen === 'addTransaction') {
            state.currentScreen = draft.currentScreen;
            if (draft.inputState) state.inputState = { ...state.inputState, ...draft.inputState };
        }
    } catch(e) {}
}


// --- Core Functions ---

window.expandImage = function(url) {
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.backgroundColor = 'rgba(0,0,0,0.85)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '9999';
    modal.style.backdropFilter = 'blur(5px)';
    modal.style.cursor = 'pointer';
    
    const closeBtn = document.createElement('div');
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '24px';
    closeBtn.style.right = '24px';
    modal.appendChild(closeBtn);
    
    const img = document.createElement('img');
    img.src = url;
    img.style.maxWidth = '90%';
    img.style.maxHeight = '90%';
    img.style.borderRadius = '12px';
    img.style.boxShadow = '0 10px 40px rgba(0,0,0,0.3)';
    img.style.objectFit = 'contain';
    
    modal.appendChild(img);
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
}

window.shareViaWhatsApp = function(txId) {
    const tx = state.transactions.find(t => t.id === txId);
    if (!tx) return;
    const formattedDate = new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-BR');
    const amountStr = Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    let text = `Comprovante de ${tx.amount < 0 ? 'Pagamento' : 'Recebimento'}\n\n`;
    text += `Valor: R$ ${amountStr}\n`;
    text += `Descrição: ${tx.description}\n`;
    text += `Data: ${formattedDate}\n`;
    text += `Categoria: ${tx.category}\n`;
    text += `ID: M-${tx.id}\n`;
    if (tx.attachmentUrl) {
        text += `\nImagem anexa: ${tx.attachmentUrl}`;
    }
    
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

window.deleteTransaction = async function(txId) {
    if (confirm('Tem certeza que deseja excluir esta transação?')) {
        const tx = state.transactions.find(t => t.id === txId);
        if (tx && tx.status === 'approved') {
            const walletIdx = state.wallets.findIndex(w => w.id === tx.wallet);
            if (walletIdx > -1) {
                state.wallets[walletIdx].balance -= tx.amount;
            }
        }
        state.transactions = state.transactions.filter(t => t.id !== txId);
        await database.set('transactions', JSON.stringify(state.transactions));
        await database.set('wallets', JSON.stringify(state.wallets));
        navigate('dashboard');
    }
}

window.toggleHideBalance = async function() {
    state.hideBalance = !state.hideBalance;
    await database.set('hideBalance', state.hideBalance.toString());
    render();
}

window.updateUser = async function(key, val) {
    if (!state.user) state.user = {};
    state.user[key] = val;
    await database.set('user', JSON.stringify(state.user));
}

window.saveProfile = async function() {
    const name = document.getElementById('profile-name').value;
    const email = document.getElementById('profile-email').value;
    window.updateUser('name', name);
    window.updateUser('email', email);
    navigate('dashboard');
}

window.clearAllData = async function() {
    if (confirm('Tem certeza? Todos os dados serão perdidos.')) {
        // Zera os saldos das carteiras atuais no estado
        const resetWallets = state.wallets.map(w => ({ ...w, balance: 0 }));
        
        await database.set('transactions', '[]');
        await database.set('user', JSON.stringify({ name: '', email: '' }));
        await database.set('wallets', JSON.stringify(resetWallets));
        await database.remove('tx_draft');
        await database.remove('hideBalance');
        await database.remove('security');
        await database.remove('user_registered');
        await database.remove('app_initialized_v2');
        
        location.reload();
    }
}

// Security Logic
window.toggleSecurity = async function(enabled) {
    if (enabled && !state.security.pin) {
        navigate('setupSecurity');
        return;
    }
    state.security.enabled = enabled;
    await database.set('security', JSON.stringify(state.security));
    render();
}

window.savePin = async function() {
    const pin = state.setupPinProgress;
    if (pin.length !== 4) {
        showToast('O PIN deve ter 4 dígitos.', 'warning');
        return;
    }
    state.security.pin = pin;
    state.security.enabled = true;
    state.security.isLocked = false;
    state.setupPinProgress = '';
    await database.set('security', JSON.stringify(state.security));
    showToast('Segurança configurada!', 'success');
    navigate('profile');
}

window.inputPin = async function(val) {
    if (val === 'back') {
        state.loginPinProgress = state.loginPinProgress.slice(0, -1);
    } else {
        if (state.loginPinProgress.length < 4) {
            state.loginPinProgress += val;
        }
    }

    render();

    if (state.loginPinProgress.length === 4) {
        if (state.loginPinProgress === state.security.pin) {
            state.security.isLocked = false;
            state.loginPinProgress = '';
            navigate('dashboard');
        } else {
            showToast('PIN incorreto', 'error');
            state.loginPinProgress = '';
            setTimeout(render, 500);
        }
    }
}

window.handleSetupPinPad = async function(val) {
    if (val === 'back') {
        state.setupPinProgress = state.setupPinProgress.slice(0, -1);
    } else {
        if (state.setupPinProgress.length < 4) {
            state.setupPinProgress += val;
        }
    }
    render();
}

window.useBiometrics = async function() {
    showToast('Escaneando biometria...', 'info');
    // Simulação de delay para biometria
    setTimeout(() => {
        state.security.isLocked = false;
        state.loginPinProgress = '';
        showToast('Acesso autorizado', 'success');
        navigate('dashboard');
    }, 1000);
}

window.exportToExcel = function() {
    const transactions = state.transactions;
    if (transactions.length === 0) {
        showToast('Não há transações para exportar.', 'warning');
        return;
    }

    // Usando ponto e vírgula como separador para compatibilidade direta com Excel em PT-BR
    let csv = 'ID;Data;Descricao;Valor;Carteira;Categoria;Status\n';
    
    transactions.forEach(t => {
        const date = new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR');
        const amount = t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const walletName = state.wallets.find(w => w.id === t.wallet)?.name || t.wallet;
        
        csv += `${t.id};${date};${t.description};${amount};${walletName};${t.category};${t.status}\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_carteira_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Relatório gerado com sucesso!', 'success');
}

window.sendReportWhatsApp = function() {
    const companyTxs = state.transactions.filter(t => t.wallet === 'empresa');
    let text = `Relatório de Prestação de Contas\n\n`;
    companyTxs.forEach(t => {
        text += `- ${t.description}: R$ ${Math.abs(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${t.status})\n`;
    });
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

function setState(newState) {
    Object.assign(state, newState);
    render();
}

async function navigate(screen) {
    // Se estiver bloqueado, não permite ir para lugar nenhum além do login
    // Exceto se for para configurar o PIN (primeira vez)
    if (state.security.enabled && state.security.isLocked && screen !== 'login' && screen !== 'setupSecurity' && screen !== 'register') {
        return;
    }

    state.prevScreen = state.currentScreen;
    if (screen === 'addTransaction') {
        state.inputState = { 
            type: 'expense',
            amount: '0', 
            description: '', 
            wallet: 'principal', 
            category: 'Alimentação',
            paid: true,
            dueDate: getLocalDate(),
            attachment: null
        };
    } else {
        await database.remove('tx_draft');
    }
    setState({ currentScreen: screen });
    saveDraft();
}

function handleNativeInput(event) {
    let val = parseFloat(event.target.value) || 0;
    state.inputState.amount = Math.round(val * 100).toString();
    saveDraft();
}

function syncInputState() {
    const desc = document.getElementById('desc-input');
    const cat = document.getElementById('cat-input');
    const wallet = document.getElementById('wallet-input');
    const date = document.getElementById('date-input');
    
    if (desc) state.inputState.description = desc.value;
    if (cat) state.inputState.category = cat.value;
    if (wallet) state.inputState.wallet = wallet.value;
    if (date) state.inputState.dueDate = date.value;
    
    saveDraft();
}

async function saveTransaction(event) {
    event.preventDefault();
    syncInputState();
    const val = parseInt(state.inputState.amount) / 100;
    
    if (val <= 0) {
        alert('Por favor, insira um valor maior que zero.');
        return;
    }

    const description = document.getElementById('desc-input').value;
    const category = document.getElementById('cat-input').value;
    const wallet = document.getElementById('wallet-input').value;
    const isPaid = state.inputState.paid;
    const dueDate = document.getElementById('date-input')?.value || state.inputState.dueDate;

    const isExpense = state.inputState.type === 'expense';
    const finalAmount = isExpense ? -val : val;

    const newTx = {
        id: Date.now(),
        date: getLocalDate(),
        time: getLocalTime(),
        dueDate: dueDate,
        description: description || 'Sem descrição',
        amount: finalAmount,
        category: category,
        wallet: wallet,
        status: isPaid ? 'approved' : 'pending',
        hasAttachment: !!state.inputState.attachment,
        attachmentUrl: state.inputState.attachmentUrl || null
    };

    let updatedWallets = state.wallets;
    if (isPaid) {
        // Update wallet balance only if paid
        updatedWallets = state.wallets.map(w => 
            w.id === wallet ? { ...w, balance: w.balance + finalAmount } : w
        );
    }

    const updatedTransactions = [newTx, ...state.transactions];
    await database.set('transactions', JSON.stringify(updatedTransactions));
    await database.remove('tx_draft');

    // Enviar para a planilha em segundo plano ou adicionar à fila offline
    if (!GOOGLE_SHEETS_URL.includes('COLE_AQUI')) {
        const txSheets = { 
            ...newTx, 
            attachmentData: state.inputState.attachmentUrl ? state.inputState.attachmentUrl : null,
            attachmentName: state.inputState.attachment || null
        };
        
        if (navigator.onLine) {
            syncToSheets(txSheets);
        } else {
            addToOfflineQueue(txSheets);
        }
    }
    
    await database.set('wallets', JSON.stringify(updatedWallets));
    
    setState({ 
        wallets: updatedWallets, 
        transactions: updatedTransactions, 
        currentScreen: 'dashboard' 
    });
}

function togglePaid() {
    syncInputState();
    state.inputState.paid = !state.inputState.paid;
    render();
}

function setTxType(type) {
    syncInputState();
    state.inputState.type = type;
    if (type === 'income') {
        state.inputState.category = 'Salário';
    } else {
        state.inputState.category = 'Alimentação';
    }
    render();
}

function triggerFileUpload() {
    syncInputState();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            state.inputState.attachment = file.name;
            const reader = new FileReader();
            reader.onload = async (evt) => {
                state.inputState.attachmentUrl = evt.target.result;
                saveDraft();
                render();
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
}

function showTransactionDetails(id) {
    state.selectedTxId = id;
    navigate('transactionDetails');
}

function payTransaction(id) {
    const txIndex = state.transactions.findIndex(t => t.id === id);
    if (txIndex === -1) return;

    const tx = state.transactions[txIndex];
    if (tx.status !== 'pending') return;

    // Confirm action
    if (!confirm('Deseja marcar esta transação como paga? O saldo da carteira será atualizado.')) return;

    // Update status and date
    tx.status = 'approved';
    tx.date = getLocalDate();

    // Update wallet balance
    const walletIndex = state.wallets.findIndex(w => w.id === tx.wallet);
    if (walletIndex !== -1) {
        state.wallets[walletIndex].balance += tx.amount;
    }

    saveState();
    render();
}

// --- Offline Sync Logic ---
async function addToOfflineQueue(tx) {
    const queueStr = await database.get('offlineQueue');
    const queue = queueStr ? JSON.parse(queueStr) : [];
    queue.push(tx);
    await database.set('offlineQueue', JSON.stringify(queue));
    showToast('Lançamento salvo offline. Sincronização automática quando conectado.', 'warning');
}

function syncToSheets(tx) {
    fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(tx)
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success' && data.imageUrl) {
            updateTransactionImage(tx.id, data.imageUrl);
        }
    })
    .catch(err => {
        console.error('Erro ao sincronizar com Planilha:', err);
        addToOfflineQueue(tx);
    });
}

async function processOfflineQueue() {
    if (!navigator.onLine) return;
    const queueStr = await database.get('offlineQueue');
    const queue = queueStr ? JSON.parse(queueStr) : [];
    if (queue.length === 0) return;

    showToast(`Sincronizando ${queue.length} lançamentos...`, 'info');
    
    // Clean queue right away
    await database.set('offlineQueue', JSON.stringify([]));
    
    let successCount = 0;
    
    Promise.all(queue.map(tx => {
        return fetch(GOOGLE_SHEETS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(tx)
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success' && data.imageUrl) {
                updateTransactionImage(tx.id, data.imageUrl);
            }
            successCount++;
        })
        .catch(async err => {
            console.error('Falha ao sincronizar item offline:', err);
            // Put it back in queue
            const currentQueueStr = await database.get('offlineQueue');
            const currentQueue = currentQueueStr ? JSON.parse(currentQueueStr) : [];
            currentQueue.push(tx);
            await database.set('offlineQueue', JSON.stringify(currentQueue));
        });
    })).finally(() => {
        if (successCount > 0) {
            showToast(`${successCount} lançamentos sincronizados com sucesso!`, 'success');
        }
    });
}

window.addEventListener('online', processOfflineQueue);

async function updateTransactionImage(id, url) {
    const txIndex = state.transactions.findIndex(t => t.id === id);
    if (txIndex > -1) {
        state.transactions[txIndex].attachmentUrl = url;
        try {
            await database.set('transactions', JSON.stringify(state.transactions));
        } catch(e) {}
        render();
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bg = type === 'success' ? 'var(--success)' : (type === 'warning' ? 'var(--warning)' : 'var(--accent-blue)');
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: ${bg};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        font-weight: 500;
        animation: slideUp 0.3s ease-out forwards;
    `;
    toast.innerText = message;
    
    if (!document.querySelector('style#toast-style')) {
        const style = document.createElement('style');
        style.id = 'toast-style';
        style.innerHTML = `@keyframes slideUp { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }`;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = 'opacity 0.3s';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function triggerFileUploadForTx(id) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const txIndex = state.transactions.findIndex(t => t.id === id);
            if (txIndex > -1) {
                const reader = new FileReader();
                reader.onload = async (evt) => {
                    const originalTx = { ...state.transactions[txIndex] };
                    state.transactions[txIndex].hasAttachment = true;
                    state.transactions[txIndex].attachmentUrl = evt.target.result;
                    
                    try {
                        await database.set('transactions', JSON.stringify(state.transactions));
                    } catch(err) {
                        alert('A imagem é muito grande para ser salva apenas localmente. Salvando online.');
                    }
                    render();
                    
                    // Sincroniza a atualização online
                    if (!GOOGLE_SHEETS_URL.includes('COLE_AQUI')) {
                        const txSheets = { 
                            ...state.transactions[txIndex], 
                            attachmentData: evt.target.result,
                            attachmentName: file.name
                        };
                        showToast('Enviando comprovante para a nuvem...', 'info');
                        if (navigator.onLine) {
                            syncToSheets(txSheets);
                        } else {
                            addToOfflineQueue(txSheets);
                        }
                    }
                };
                reader.readAsDataURL(file);
            }
        }
    };
    input.click();
}

// --- Icons Helper ---
function icon(name, color = 'currentColor', size = 24) {
    return `<i data-lucide="${name}" style="color: ${color}; width: ${size}px; height: ${size}px;"></i>`;
}

// --- Screens ---

const Screens = {
    register: () => {
        return `
        <div class="content-area animate-in" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 24px;">
            <div class="glass" style="width: 80px; height: 80px; border-radius: 24px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); margin-bottom: 24px; box-shadow: 0 8px 32px rgba(59, 130, 246, 0.3);">
                ${icon('wallet', 'white', 40)}
            </div>
            
            <h1 class="h1" style="margin-bottom: 8px; text-align: center;">Bem-vindo ao Carteira</h1>
            <p class="caption" style="margin-bottom: 40px; text-align: center;">Configure seus dados para começar a usar o app</p>
            
            <div style="width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 16px;">
                <div class="glass-card" style="padding: 16px 20px;">
                    <p class="caption" style="font-size: 12px; margin-bottom: 6px;">${icon('user', 'var(--text-secondary)', 14)} Seu Nome</p>
                    <input type="text" id="register-name" placeholder="Ex: João Silva" required style="background: none; border: none; color: var(--text-primary); font-family: inherit; font-size: 16px; width: 100%; outline: none; font-weight: 500;">
                </div>
                
                <div class="glass-card" style="padding: 16px 20px;">
                    <p class="caption" style="font-size: 12px; margin-bottom: 6px;">${icon('mail', 'var(--text-secondary)', 14)} Seu Email</p>
                    <input type="email" id="register-email" placeholder="Ex: joao@email.com" required style="background: none; border: none; color: var(--text-primary); font-family: inherit; font-size: 16px; width: 100%; outline: none; font-weight: 500;">
                </div>

                <div class="glass-card" style="padding: 16px 20px;">
                    <p class="caption" style="font-size: 12px; margin-bottom: 6px;">${icon('lock', 'var(--text-secondary)', 14)} Crie um PIN de 4 dígitos</p>
                    <input type="password" id="register-pin" maxlength="4" pattern="[0-9]{4}" inputmode="numeric" placeholder="••••" required style="background: none; border: none; color: var(--text-primary); font-family: inherit; font-size: 24px; width: 100%; outline: none; font-weight: 700; letter-spacing: 12px; text-align: center;">
                </div>

                <div class="glass-card" style="padding: 16px 20px;">
                    <p class="caption" style="font-size: 12px; margin-bottom: 6px;">${icon('lock', 'var(--text-secondary)', 14)} Confirme o PIN</p>
                    <input type="password" id="register-pin-confirm" maxlength="4" pattern="[0-9]{4}" inputmode="numeric" placeholder="••••" required style="background: none; border: none; color: var(--text-primary); font-family: inherit; font-size: 24px; width: 100%; outline: none; font-weight: 700; letter-spacing: 12px; text-align: center;">
                </div>
                
                <button class="btn btn-primary" style="padding: 18px; width: 100%; font-size: 16px; margin-top: 16px;" onclick="completeRegistration()">
                    Começar a usar
                </button>
            </div>
        </div>
        `;
    },

    dashboard: () => `
        <div class="content-area animate-in">
            <header style="margin-bottom: 32px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <p class="caption">Bem-vindo,</p>
                    <h1 class="h1">${state.user?.name || 'Seu Nome'}</h1>
                </div>
                <div onclick="toggleHideBalance()" class="glass" style="width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    ${icon(state.hideBalance ? 'eye-off' : 'eye', 'var(--text-secondary)', 20)}
                </div>
            </header>

            <section style="margin-bottom: 32px; overflow-x: auto; display: flex; gap: 16px; padding: 4px; padding-bottom: 12px; scrollbar-width: none; -ms-overflow-style: none;">
                ${state.wallets.map(w => `
                    <div class="glass-card" style="min-width: 170px; flex-shrink: 0; background: linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%);">
                        <div style="background: ${w.color}11; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                            ${icon(w.icon, w.color, 20)}
                        </div>
                        <p class="caption">${w.name}</p>
                        <h2 class="amount" style="margin-top: 4px; font-size: 22px;">
                            ${state.hideBalance ? '••••••' : `R$ ${w.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                        </h2>
                    </div>
                `).join('')}
            </section>

            <section style="margin-bottom: 32px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h2 class="h2">Ação Rápida</h2>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="glass-card" onclick="navigate('addTransaction')" style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px; cursor: pointer;">
                        ${icon('plus', 'var(--accent-blue)')}
                        <span style="font-size: 14px; font-weight: 500;">Novo Lançamento</span>
                    </div>
                    <div class="glass-card" onclick="navigate('accountability')" style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px; cursor: pointer;">
                        ${icon('file-text', 'var(--accent-purple)')}
                        <span style="font-size: 14px; font-weight: 500;">Pagar Empresa</span>
                    </div>
                </div>
            </section>

            <!-- Seção de Vencimentos -->
            ${(() => {
                const today = getLocalDate();
                const expiringToday = state.transactions.filter(t => t.status === 'pending' && t.dueDate === today);
                
                if (expiringToday.length === 0) return '';
                
                return `
                <div class="glass-card animate-in" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); margin-bottom: 32px; padding: 16px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--error); display: flex; align-items: center; justify-content: center;">
                            ${icon('alert-circle', 'white', 18)}
                        </div>
                        <span style="font-weight: 700; color: var(--error);">Vencendo Hoje</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${expiringToday.map(t => `
                            <div onclick="showTransactionDetails(${t.id})" style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 12px; border-radius: 12px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                <span style="font-weight: 600; font-size: 14px;">${t.description}</span>
                                <span style="font-weight: 700; color: var(--error);">R$ ${Math.abs(t.amount).toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                `;
            })()}

            <section style="margin-bottom: 32px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h2 class="h2">Próximos Vencimentos</h2>
                    <p class="caption">Agendados</p>
                </div>
                <div style="overflow-x: auto; display: flex; gap: 12px; padding: 4px; scrollbar-width: none;">
                    ${state.transactions.filter(t => t.status === 'pending').map(t => `
                        <div class="glass-card" style="min-width: 200px; border-left: 4px solid var(--warning);">
                            <p style="font-weight: 500; font-size: 14px;">${t.description}</p>
                            <p class="caption" style="font-size: 11px; margin: 4px 0;">Vence em: ${new Date(t.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                            <h3 class="amount" style="font-size: 18px; color: var(--warning);">R$ ${Math.abs(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                        </div>
                    `).join('') || '<p class="caption">Nenhuma conta pendente.</p>'}
                </div>
            </section>

            <section style="margin-bottom: 32px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h2 class="h2">Atividades Recentes</h2>
                    <p class="caption" style="color: var(--accent-blue); cursor: pointer;" onclick="navigate('extract')">Ver tudo</p>
                </div>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${state.transactions.slice(0, 3).map(t => `
                        <div class="glass-card" onclick="showTransactionDetails(${t.id})" style="display: flex; align-items: center; gap: 16px; padding: 14px; cursor: pointer;">
                            <div class="glass" style="width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: ${t.amount < 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)'};">
                                ${icon(t.amount < 0 ? 'arrow-down-right' : 'arrow-up-right', t.amount < 0 ? 'var(--error)' : 'var(--success)', 18)}
                            </div>
                            <div style="flex: 1;">
                                <p style="font-weight: 500; font-size: 15px;">${t.description}</p>
                                <p class="caption" style="font-size: 12px;">${t.category} ${t.status === 'pending' ? '• Pendente' : ''}</p>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 14px; font-weight: 600; color: ${t.amount < 0 ? 'var(--error)' : 'var(--success)'}">
                                ${state.hideBalance ? '••••••' : `${t.amount < 0 ? '-' : ''} R$ ${Math.abs(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                            </span>
                            ${icon('chevron-right', 'var(--text-secondary)', 16)}
                        </div>
                        </div>
                    `).join('')}
                </div>
            </section>
        </div>
    `,

    addTransaction: () => `
        <div class="content-area animate-in">
            <header style="margin-bottom: 24px; display: flex; align-items: center; gap: 16px;">
                <button onclick="navigate('dashboard')" class="glass" style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    ${icon('chevron-left')}
                </button>
                <h1 class="h2">Novo Lançamento</h1>
            </header>

            <form onsubmit="saveTransaction(event)">
                <div style="display: flex; background: rgba(0,0,0,0.05); border-radius: 12px; padding: 4px; margin-bottom: 24px;">
                    <button type="button" onclick="setTxType('expense')" style="flex: 1; padding: 10px; border-radius: 8px; border: none; font-weight: 500; font-family: inherit; font-size: 14px; cursor: pointer; transition: all 0.2s; ${state.inputState.type === 'expense' ? 'background: var(--error); color: white; box-shadow: var(--shadow-soft);' : 'background: transparent; color: var(--text-secondary);'}">
                        Saída (Despesa)
                    </button>
                    <button type="button" onclick="setTxType('income')" style="flex: 1; padding: 10px; border-radius: 8px; border: none; font-weight: 500; font-family: inherit; font-size: 14px; cursor: pointer; transition: all 0.2s; ${state.inputState.type === 'income' ? 'background: var(--success); color: white; box-shadow: var(--shadow-soft);' : 'background: transparent; color: var(--text-secondary);'}">
                        Entrada (Receita)
                    </button>
                </div>

                <div style="text-align: center; margin-bottom: 32px;">
                    <p class="caption">Valor do lançamento</p>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span style="font-size: 24px; color: var(--text-secondary)">R$</span>
                        <input type="number" inputmode="decimal" step="0.01" id="display-amount" placeholder="0.00" value="${state.inputState.amount === '0' || !state.inputState.amount ? '' : (parseInt(state.inputState.amount) / 100).toFixed(2)}" oninput="handleNativeInput(event)" style="font-size: 48px; font-weight: bold; background: transparent; border: none; color: var(--text-primary); width: 140px; text-align: center; outline: none; font-family: inherit;">
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
                    <div class="glass-card" style="padding: 12px 20px;">
                        <p class="caption" style="font-size: 12px; margin-bottom: 4px;">Descrição</p>
                        <input type="text" id="desc-input" placeholder="Ex: Almoço" required style="background: none; border: none; color: var(--text-primary); font-family: inherit; font-size: 16px; width: 100%; outline: none;" value="${state.inputState.description}">
                    </div>
                    
                    <div class="glass-card" style="padding: 12px 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <p class="caption" style="font-size: 12px; margin-bottom: 4px;">Carteira</p>
                            <select id="wallet-input" style="background: none; border: none; color: var(--text-primary); font-family: inherit; font-size: 14px; width: 100%; outline: none; appearance: none;">
                                ${state.wallets.map(w => `<option value="${w.id}" ${state.inputState.wallet === w.id ? 'selected' : ''} style="background: white; color: #000;">${w.name}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <p class="caption" style="font-size: 12px; margin-bottom: 4px;">Categoria</p>
                            <select id="cat-input" onchange="state.inputState.category = this.value" style="background: none; border: none; color: var(--text-primary); font-family: inherit; font-size: 14px; width: 100%; outline: none; appearance: none;">
                                ${state.inputState.type === 'expense' ? `
                                    <option ${state.inputState.category === 'Alimentação' ? 'selected' : ''} style="background: white; color: #000;">Alimentação</option>
                                    <option ${state.inputState.category === 'Transporte' ? 'selected' : ''} style="background: white; color: #000;">Transporte</option>
                                    <option ${state.inputState.category === 'Assinaturas' ? 'selected' : ''} style="background: white; color: #000;">Assinaturas</option>
                                    <option ${state.inputState.category === 'Viagem' ? 'selected' : ''} style="background: white; color: #000;">Viagem</option>
                                    <option ${state.inputState.category === 'Outros' ? 'selected' : ''} style="background: white; color: #000;">Outros</option>
                                ` : `
                                    <option ${state.inputState.category === 'Salário' ? 'selected' : ''} style="background: white; color: #000;">Salário</option>
                                    <option ${state.inputState.category === 'Rendimento' ? 'selected' : ''} style="background: white; color: #000;">Rendimento</option>
                                    <option ${state.inputState.category === 'Reembolso' ? 'selected' : ''} style="background: white; color: #000;">Reembolso</option>
                                    <option ${state.inputState.category === 'Outros' ? 'selected' : ''} style="background: white; color: #000;">Outros</option>
                                `}
                            </select>
                        </div>
                    </div>

                    <div class="glass-card" style="padding: 12px 20px; display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <p class="caption" style="font-size: 12px; margin-bottom: 2px;">Data do Lançamento / Vencimento</p>
                             <input type="date" id="date-input" style="background: none; border: none; color: var(--text-primary); font-family: inherit; font-size: 14px; outline: none;" value="${state.inputState.dueDate}">
                        </div>
                        <div style="text-align: right;">
                            <p class="caption" style="font-size: 12px; margin-bottom: 2px;">Já foi pago?</p>
                            <div class="glass" onclick="togglePaid()" style="padding: 4px 12px; border-radius: 20px; font-size: 12px; cursor: pointer; ${state.inputState.paid ? 'background: var(--accent-blue);' : ''}">
                                ${state.inputState.paid ? 'PAGO' : 'PENDENTE'}
                            </div>
                        </div>
                    </div>

                    <div class="glass-card" onclick="triggerFileUpload()" style="padding: 12px 20px; display: flex; align-items: center; gap: 12px; cursor: pointer;">
                        <div class="glass" style="width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.03);">
                            ${icon('camera', state.inputState.attachment ? 'var(--accent-blue)' : 'var(--text-primary)', 16)}
                        </div>
                        <p style="font-size: 14px; font-weight: 500;">
                            ${state.inputState.attachment ? 'Comprovante Anexado' : 'Anexar Nota / Comprovante'}
                        </p>
                    </div>
                </div>



                <button type="submit" class="btn btn-primary" style="padding: 18px; width: 100%; font-size: 16px;">Confirmar Lançamento</button>
            </form>
        </div>
    `,

    extract: () => {
        const grouped = state.transactions.reduce((acc, t) => {
            if (!acc[t.date]) acc[t.date] = [];
            acc[t.date].push(t);
            return acc;
        }, {});
        const sortedDates = Object.keys(grouped).sort((a,b) => b.localeCompare(a));

        return `
        <div class="content-area animate-in">
            <h1 class="h1" style="margin-bottom: 24px;">Extrato</h1>
            
            <div style="display: flex; gap: 8px; margin-bottom: 32px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none;">
                <div class="glass" style="padding: 10px 20px; border-radius: 20px; font-size: 14px; background: var(--accent-blue); border-color: transparent; white-space: nowrap;">Todos</div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 32px;">
                ${sortedDates.map(date => {
                    const txs = grouped[date];
                    if (txs.length === 0) return '';
                    
                    const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });

                    return `
                        <div>
                            <p class="caption" style="margin-bottom: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">${formattedDate}</p>
                            <div style="display: flex; flex-direction: column; gap: 12px;">
                                ${txs.map(t => `
                                    <div class="glass-card" onclick="showTransactionDetails(${t.id})" style="display: flex; align-items: center; gap: 16px; position: relative; border-left: ${t.status === 'pending' ? '3px solid var(--warning)' : 'none'}; cursor: pointer;">
                                        <div class="glass" style="width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: ${t.amount < 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)'};">
                                            ${icon(t.amount < 0 ? 'arrow-down-right' : 'arrow-up-right', t.amount < 0 ? 'var(--error)' : 'var(--success)', 20)}
                                        </div>
                                        <div style="flex: 1;">
                                            <p style="font-weight: 500;">${t.description}</p>
                                            <p class="caption">
                                                ${t.category} • ${state.wallets.find(w => w.id === t.wallet)?.name}
                                                ${t.status === 'pending' ? ` • ${icon('clock', 'var(--warning)', 12)} Pendente` : ''}
                                            </p>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 14px; font-weight: 600;">
                                R$ ${Math.abs(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                            ${icon('chevron-right', 'var(--text-secondary)', 16)}
                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        `;
    },

    accountability: () => {
        const companyTxs = state.transactions.filter(t => t.wallet === 'empresa');
        const approved = companyTxs.filter(t => t.status === 'approved');
        const pending = companyTxs.filter(t => t.status === 'pending');

        return `
        <div class="content-area animate-in">
            <header style="margin-bottom: 24px; display: flex; align-items: center; gap: 12px;">
                <div onclick="navigate('dashboard')" style="cursor: pointer;">${icon('arrow-left')}</div>
                <div>
                    <h1 class="h1">Prestação de Contas</h1>
                    <p class="caption">Carteira Corporativa</p>
                </div>
            </header>

            <div class="glass-card" style="background: linear-gradient(135deg, var(--accent-blue) 0%, var(--accent-purple) 100%); margin-bottom: 32px; padding: 24px;">
                <p class="caption" style="color: rgba(255,255,255,0.8)">Saldo da Empresa</p>
                <h1 class="amount" style="font-size: 32px; margin: 8px 0; color: white;">
                    R$ ${state.wallets.find(w => w.id === 'empresa').balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h1>
                <p class="caption" style="color: rgba(255,255,255,0.8); margin-top: 16px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 12px;">Total Aprovado Reembolso: R$ ${approved.reduce((acc, t) => acc + Math.abs(t.amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 12px;">
                    <div class="glass" style="padding: 4px 12px; border-radius: 20px; font-size: 11px; background: rgba(16, 185, 129, 0.2); color: #10b981; border: none;">${approved.length} APROVADOS</div>
                    <div class="glass" style="padding: 4px 12px; border-radius: 20px; font-size: 11px; background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: none;">${pending.length} PENDENTES</div>
                </div>
            </div>

            <h2 class="h2" style="margin-bottom: 16px; font-size: 18px;">Despesas Recentes</h2>
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${companyTxs.map(t => {
                    let statusColor = 'var(--warning)';
                    let statusBg = 'rgba(245, 158, 11, 0.1)';
                    let statusText = 'Pendente';

                    if (t.status === 'approved') {
                        statusColor = 'var(--success)';
                        statusBg = 'rgba(16, 185, 129, 0.1)';
                        statusText = 'Aprovado';
                    } else if (t.status === 'in_review') {
                        statusColor = 'var(--accent-blue)';
                        statusBg = 'rgba(59, 130, 246, 0.1)';
                        statusText = 'Em revisão';
                    }

                    return `
                        <div class="glass-card" onclick="showTransactionDetails(${t.id})" style="padding: 16px; cursor: pointer;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                                <div>
                                    <p style="font-weight: 600; font-size: 14px;">${t.description}</p>
                                    <p class="caption" style="font-size: 11px;">${new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                                </div>
                                <p class="amount" style="font-size: 14px;">R$ ${Math.abs(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; align-items: center; gap: 6px; color: ${statusColor}; background: ${statusBg}; padding: 4px 10px; border-radius: 8px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                                    <div style="width: 5px; height: 5px; border-radius: 50%; background: ${statusColor}"></div>
                                    ${statusText}
                                </div>
                                ${t.hasAttachment ? icon('paperclip', 'var(--text-secondary)', 14) : ''}
                            </div>
                        </div>
                    `;
                }).join('') || '<p class="caption">Nenhuma despesa encontrada.</p>'}
            </div>
            
            <button class="btn btn-primary" style="width: 100%; margin-top: 32px;" onclick="sendReportWhatsApp()">
                Enviar Relatório via WhatsApp
            </button>
        </div>
        `;
    },

    setupSecurity: () => {
        const dotStyle = (filled) => `width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--accent-blue); background: ${filled ? 'var(--accent-blue)' : 'transparent'}; transition: all 0.2s;`;
        
        return `
        <div class="content-area animate-in" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; padding-bottom: 24px;">
            <h1 class="h1" style="margin-bottom: 8px;">Definir PIN</h1>
            <p class="caption" style="margin-bottom: 40px;">Crie um código de 4 dígitos para proteger seu app</p>
            
            <div style="display: flex; gap: 20px; margin-bottom: 60px;">
                <div style="${dotStyle(state.setupPinProgress.length >= 1)}"></div>
                <div style="${dotStyle(state.setupPinProgress.length >= 2)}"></div>
                <div style="${dotStyle(state.setupPinProgress.length >= 3)}"></div>
                <div style="${dotStyle(state.setupPinProgress.length >= 4)}"></div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; width: 100%; max-width: 280px;">
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `
                    <div class="glass numpad-btn" onclick="handleSetupPinPad('${num}')" style="width: 70px; height: 70px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 600; cursor: pointer;">${num}</div>
                `).join('')}
                <div style="width: 70px; height: 70px;"></div>
                <div class="glass numpad-btn" onclick="handleSetupPinPad('0')" style="width: 70px; height: 70px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 600; cursor: pointer;">0</div>
                <div class="glass numpad-btn" onclick="handleSetupPinPad('back')" style="width: 70px; height: 70px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    ${icon('delete', 'var(--text-primary)', 24)}
                </div>
            </div>

            <button class="btn btn-primary" style="margin-top: 48px; width: 100%; max-width: 280px; opacity: ${state.setupPinProgress.length === 4 ? 1 : 0.5}" ${state.setupPinProgress.length === 4 ? 'onclick="savePin()"' : 'disabled'}>
                Confirmar PIN
            </button>
            
            <p class="caption" onclick="navigate('profile')" style="margin-top: 24px; cursor: pointer;">Pular por enquanto</p>
        </div>
        <input type="hidden" id="setup-pin" value="${state.setupPinProgress}">
        `;
    },

    login: () => {
        const dotStyle = (filled) => `width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid var(--accent-blue); background: ${filled ? 'var(--accent-blue)' : 'transparent'}; transition: all 0.2s ease;`;
        
        return `
        <div class="content-area animate-in" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; padding-top: 40px;">
            <div class="glass" style="width: 80px; height: 80px; border-radius: 24px; display: flex; align-items: center; justify-content: center; background: white; margin-bottom: 24px; box-shadow: var(--shadow-soft);">
                ${icon('shield-check', 'var(--accent-blue)', 40)}
            </div>
            
            <h1 class="h1" style="margin-bottom: 8px;">Acesso Restrito</h1>
            <p class="caption" style="margin-bottom: 48px;">Digite seu PIN para continuar</p>
            
            <div style="display: flex; gap: 24px; margin-bottom: 64px;">
                <div style="${dotStyle(state.loginPinProgress.length >= 1)}"></div>
                <div style="${dotStyle(state.loginPinProgress.length >= 2)}"></div>
                <div style="${dotStyle(state.loginPinProgress.length >= 3)}"></div>
                <div style="${dotStyle(state.loginPinProgress.length >= 4)}"></div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; width: 100%; max-width: 300px;">
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `
                    <div class="glass numpad-btn" onclick="inputPin('${num}')" style="width: 75px; height: 75px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 600; cursor: pointer;">${num}</div>
                `).join('')}
                <div class="glass numpad-btn" onclick="useBiometrics()" style="width: 75px; height: 75px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    ${icon('fingerprint', 'var(--accent-blue)', 28)}
                </div>
                <div class="glass numpad-btn" onclick="inputPin('0')" style="width: 75px; height: 75px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 600; cursor: pointer;">0</div>
                <div class="glass numpad-btn" onclick="inputPin('back')" style="width: 75px; height: 75px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    ${icon('delete', 'var(--text-primary)', 24)}
                </div>
            </div>

            <p class="caption" onclick="navigate('dashboard')" style="margin-top: 40px; color: var(--accent-blue); font-weight: 600; cursor: pointer;">Esqueci meu PIN</p>
        </div>
        `;
    },

    transactionDetails: () => {
        const tx = state.transactions.find(t => t.id === state.selectedTxId);
        if (!tx) return `<div class="content-area"><p>Transação não encontrada.</p><button class="btn btn-primary" onclick="navigate('dashboard')">Voltar</button></div>`;

        const formattedDate = new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        
        return `
        <div class="content-area animate-in" style="background: var(--bg-primary); min-height: 100vh; padding-top: 24px;">
            <header style="margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
                <div onclick="navigate(state.prevScreen || 'dashboard')" style="cursor: pointer; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.05); border-radius: 50%;">
                    ${icon('arrow-left')}
                </div>
                <div style="font-weight: 600;">Detalhes</div>
                <div onclick="deleteTransaction(${tx.id})" style="cursor: pointer; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: rgba(239, 68, 68, 0.1); border-radius: 50%;">
                    ${icon('trash-2', 'var(--error)')}
                </div>
            </header>

            <div style="background: white; border-radius: 24px; padding: 32px 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.05); position: relative; overflow: hidden;">
                <!-- Subtle background watermark/pattern could go here -->
                
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-blue); display: flex; align-items: center; justify-content: center;">
                        ${icon('check', 'white', 16)}
                    </div>
                    <span style="font-weight: 700; font-size: 16px; color: var(--text-primary);">Comprovante de ${tx.amount < 0 ? 'pagamento' : 'recebimento'}</span>
                </div>
                <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 32px;">${formattedDate}${tx.time ? ` às ${tx.time}` : ''}</p>
                
                <div style="margin-bottom: 32px;">
                    <p style="font-weight: 700; font-size: 16px; text-transform: uppercase; color: var(--text-primary); letter-spacing: 0.5px; margin-bottom: 4px;">${tx.description}</p>
                    <h1 style="font-size: 36px; font-weight: 800; color: var(--text-primary); margin: 0; line-height: 1;">
                        R$ ${Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h1>
                </div>

                <hr style="border: none; border-top: 1px dashed rgba(0,0,0,0.1); margin: 24px 0;">

                <div style="display: flex; flex-direction: column; gap: 24px;">
                    <div>
                        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 4px;">Status</p>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${tx.status === 'approved' ? 'var(--success)' : 'var(--warning)'};"></div>
                            <p style="font-weight: 600; font-size: 15px; color: ${tx.status === 'approved' ? 'var(--success)' : 'var(--warning)'};">
                                ${tx.status === 'approved' ? 'Confirmado' : 'Pendente (Agendado)'}
                            </p>
                        </div>
                    </div>

                    <hr style="border: none; border-top: 1px solid rgba(0,0,0,0.05); margin: 0;">

                    <div>
                        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 4px;">ID da transação</p>
                        <p style="font-weight: 600; font-size: 15px;">M-${tx.id}</p>
                    </div>
                    
                    <hr style="border: none; border-top: 1px solid rgba(0,0,0,0.05); margin: 0;">

                    <div>
                        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 4px;">Categoria</p>
                        <p style="font-weight: 600; font-size: 15px;">${tx.category}</p>
                    </div>

                    <hr style="border: none; border-top: 1px solid rgba(0,0,0,0.05); margin: 0;">

                    <div>
                        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 4px;">Carteira / Origem</p>
                        <p style="font-weight: 600; font-size: 15px;">${state.wallets.find(w => w.id === tx.wallet)?.name || 'N/A'}</p>
                    </div>
                </div>

                ${tx.status === 'pending' ? `
                    <div style="margin-top: 32px;">
                        <button onclick="payTransaction(${tx.id})" class="btn btn-primary" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--success); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);">
                            ${icon('check-circle', 'white', 18)}
                            Marcar como Pago
                        </button>
                    </div>
                ` : ''}
                
                <div style="margin-top: 40px;">
                    <p style="font-weight: 600; font-size: 14px; margin-bottom: 16px;">Comprovante Anexado</p>
                    ${tx.hasAttachment && tx.attachmentUrl ? `
                        <div onclick="expandImage('${tx.attachmentUrl}')" style="border-radius: 16px; overflow: hidden; border: 1px solid rgba(0,0,0,0.1); position: relative; background: #f9fafb; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 160px; background-image: url('${tx.attachmentUrl}'); background-size: cover; background-position: center; cursor: pointer;">
                        </div>
                    ` : tx.hasAttachment ? `
                        <div style="border-radius: 16px; overflow: hidden; border: 1px solid rgba(0,0,0,0.1); position: relative; background: #f9fafb; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 160px;">
                            ${icon('image', 'var(--text-secondary)', 48)}
                            <p style="color: var(--text-secondary); font-size: 13px; margin-top: 12px; font-weight: 500;">Imagem Recibo (Amostra)</p>
                        </div>
                    ` : `
                        <div onclick="triggerFileUploadForTx(${tx.id})" style="border-radius: 16px; border: 2px dashed rgba(0,0,0,0.15); background: rgba(0,0,0,0.02); height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease;">
                            <div style="width: 40px; height: 40px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                                ${icon('camera', 'var(--accent-blue)', 20)}
                            </div>
                            <span style="font-weight: 600; font-size: 14px; color: var(--accent-blue);">Anexar Comprovante</span>
                        </div>
                    `}
                </div>
            </div>
            
            <button onclick="shareViaWhatsApp(${tx.id})" class="glass" style="position: fixed; bottom: 32px; right: 32px; width: 56px; height: 56px; border-radius: 16px; background: var(--accent-purple); color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 25px rgba(139, 92, 246, 0.4); border: none; cursor: pointer; z-index: 10;">
                ${icon('share-2', 'white', 24)}
            </button>
        </div>
        `;
    },

    report: () => {
        const inflow = state.transactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
        const outflow = Math.abs(state.transactions.filter(t => t.amount < 0).reduce((acc, t) => acc + t.amount, 0));
        
        const categoryData = state.transactions.filter(t => t.amount < 0).reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
            return acc;
        }, {});

        const categories = Object.keys(categoryData).map(name => ({
            name,
            amount: categoryData[name],
            percent: outflow > 0 ? (categoryData[name] / outflow * 100).toFixed(0) : 0
        })).sort((a, b) => b.amount - a.amount);

        const categoryIcons = {
            'Alimentação': 'coffee',
            'Transporte': 'truck',
            'Viagem': 'map',
            'Saúde': 'activity',
            'Educação': 'book',
            'Assinaturas': 'refresh-cw',
            'Compras': 'shopping-cart',
            'Outros': 'grid'
        };

        return `
        <div class="content-area animate-in">
            <h1 class="h1" style="margin-bottom: 24px;">Visão Geral</h1>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;">
                <div class="glass-card" style="text-align: center;">
                    <p class="caption" style="font-size: 12px;">Entradas</p>
                    <p class="amount" style="color: var(--success); font-size: 20px;">
                        ${state.hideBalance ? '••••••' : `R$ ${inflow.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </p>
                </div>
                <div class="glass-card" style="text-align: center;">
                    <p class="caption" style="font-size: 12px;">Saídas</p>
                    <p class="amount" style="color: var(--error); font-size: 20px;">
                        ${state.hideBalance ? '••••••' : `R$ ${outflow.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </p>
                </div>
            </div>

            <h2 class="h2" style="margin-bottom: 16px;">Distribuição</h2>
            <div class="glass-card" style="display: flex; flex-direction: column; gap: 20px;">
                ${(() => {
                    if (categories.length === 0) return '<p class="caption" style="text-align: center; padding: 20px;">Nenhuma despesa registrada para análise.</p>';
                    return categories.map((cat, idx) => `
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div class="glass" style="width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: rgba(59, 130, 246, 0.1);">
                            ${icon(categoryIcons[cat.name] || 'grid', idx % 2 === 0 ? 'var(--accent-blue)' : 'var(--accent-purple)', 20)}
                        </div>
                        <div style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                                <span style="font-weight: 500; font-size: 14px;">${cat.name}</span>
                                <span class="caption" style="font-size: 12px;">${cat.percent}%</span>
                            </div>
                            <div style="height: 6px; background: rgba(0,0,0,0.05); border-radius: 3px; overflow: hidden;">
                                <div style="width: ${cat.percent}%; height: 100%; background: ${idx % 2 === 0 ? 'var(--accent-blue)' : 'var(--accent-purple)'}"></div>
                            </div>
                        </div>
                    </div>
                `).join('');
                })()}
            </div>
        </div>
        `;
    },

    profile: () => `
        <div class="content-area animate-in">
            <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div onclick="navigate('dashboard')" style="cursor: pointer; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.05); border-radius: 50%;">
                    ${icon('arrow-left')}
                </div>
                <div style="font-weight: 600; font-size: 20px;">Perfil</div>
                <div style="width: 40px;"></div>
            </header>

            <!-- Avatar e Dados -->
            <div class="glass-card" style="padding: 24px; text-align: center; margin-bottom: 16px;">
                <div style="width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; box-shadow: 0 4px 16px rgba(59,130,246,0.3);">
                    <span style="color: white; font-size: 28px; font-weight: 700;">${(state.user?.name || 'U').charAt(0).toUpperCase()}</span>
                </div>
                <h2 class="h2" style="margin-bottom: 4px;">${state.user?.name || 'Seu Nome'}</h2>
                <p class="caption">${state.user?.email || 'seu@email.com'}</p>
            </div>

            <div class="glass-card" style="padding: 24px;">
                <h2 class="h2" style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                    ${icon('user-cog', 'var(--accent-blue)', 20)} Editar Dados
                </h2>
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Nome</label>
                    <input id="profile-name" type="text" value="${state.user?.name || ''}" placeholder="Seu nome" style="width: 100%; border: none; background: rgba(0,0,0,0.05); padding: 12px; border-radius: 10px; margin-top: 4px; font-weight: 500; font-family: inherit; font-size: 15px;">
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 13px; color: var(--text-secondary); font-weight: 500;">Email</label>
                    <input id="profile-email" type="email" value="${state.user?.email || ''}" placeholder="seu@email.com" style="width: 100%; border: none; background: rgba(0,0,0,0.05); padding: 12px; border-radius: 10px; margin-top: 4px; font-weight: 500; font-family: inherit; font-size: 15px;">
                </div>
                
                <button class="btn btn-primary" style="width: 100%; margin-top: 8px;" onclick="saveProfile()">Salvar Alterações</button>
            </div>

            <div class="glass-card" style="padding: 24px; margin-top: 16px;">
                <h2 class="h2" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    ${icon('shield', 'var(--accent-blue)', 20)} Segurança
                </h2>
                <p class="caption" style="margin-bottom: 16px;">Gerencie seu PIN e configurações de acesso.</p>
                
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(0,0,0,0.03); border-radius: 10px; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${icon('lock', 'var(--text-secondary)', 18)}
                        <span style="font-weight: 500; font-size: 14px;">Bloqueio por PIN</span>
                    </div>
                    <label class="switch">
                        <input type="checkbox" ${state.security.enabled ? 'checked' : ''} onchange="toggleSecurity(this.checked)">
                        <span class="slider round"></span>
                    </label>
                </div>
                
                ${state.security.enabled ? `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <button class="btn btn-secondary" style="width: 100%; border: 1px solid var(--accent-blue); color: var(--accent-blue); display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="navigate('setupSecurity')">
                        ${icon('key', 'var(--accent-blue)', 16)} Alterar PIN
                    </button>
                    <button class="btn btn-secondary" style="width: 100%; border: 1px solid var(--accent-purple); color: var(--accent-purple); display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="showChangePinInline()">
                        ${icon('fingerprint', 'var(--accent-purple)', 16)} Biometria ${state.security.biometrics ? '(Ativada)' : '(Desativada)'}
                    </button>
                </div>
                ` : ''}
            </div>

            <div class="glass-card" style="padding: 24px; margin-top: 16px;">
                <h2 class="h2" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    ${icon('file-spreadsheet', 'var(--success)', 20)} Exportar Dados
                </h2>
                <p class="caption" style="margin-bottom: 16px;">Gere um CSV com todos os lançamentos.</p>
                <button class="btn btn-primary" style="width: 100%; background: var(--success); display: flex; align-items: center; justify-content: center; gap: 8px;" onclick="exportToExcel()">
                    ${icon('download', '#fff', 18)}
                    Exportar para Excel
                </button>
            </div>

            <div class="glass-card" style="padding: 24px; margin-top: 16px; border: 1px solid rgba(239,68,68,0.2);">
                <h2 class="h2" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: var(--error);">
                    ${icon('alert-triangle', 'var(--error)', 20)} Zona de Perigo
                </h2>
                <p class="caption" style="margin-bottom: 16px;">Apague todos os dados ou redefina seu acesso.</p>
                <button class="btn btn-secondary" style="width: 100%; border: 1px solid var(--error); color: var(--error);" onclick="clearAllData()">Limpar Todos os Dados</button>
            </div>
        </div>
    `
};

// --- Main Render Functions ---

function renderNavBar() {
    return `
        <nav class="nav-bar glass">
            <div class="nav-item ${state.currentScreen === 'dashboard' ? 'active' : ''}" onclick="navigate('dashboard')">
                ${icon('layout-grid', state.currentScreen === 'dashboard' ? 'var(--accent-blue)' : 'var(--text-secondary)')}
                <span>Home</span>
            </div>
            <div class="nav-item ${state.currentScreen === 'extract' ? 'active' : ''}" onclick="navigate('extract')">
                ${icon('list', state.currentScreen === 'extract' ? 'var(--accent-blue)' : 'var(--text-secondary)')}
                <span>Extrato</span>
            </div>
            <div class="nav-item ${state.currentScreen === 'addTransaction' ? 'active' : ''}" onclick="navigate('addTransaction')">
                <div class="glass" style="width: 54px; height: 54px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); margin-top: -30px; border: 4px solid white; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);">
                    ${icon('plus', '#fff', 28)}
                </div>
            </div>
            <div class="nav-item ${['report', 'accountability'].includes(state.currentScreen) ? 'active' : ''}" onclick="navigate('report')">
                ${icon('pie-chart', ['report', 'accountability'].includes(state.currentScreen) ? 'var(--accent-blue)' : 'var(--text-secondary)')}
                <span>Análise</span>
            </div>
            <div class="nav-item ${state.currentScreen === 'profile' ? 'active' : ''}" onclick="navigate('profile')">
                ${icon('user', state.currentScreen === 'profile' ? 'var(--accent-blue)' : 'var(--text-secondary)')}
                <span>Perfil</span>
            </div>
        </nav>
    `;
}

function render() {
    const app = document.getElementById('app');
    const screenHtml = Screens[state.currentScreen]();
    
    const showNav = ['dashboard', 'extract', 'report', 'accountability', 'profile'].includes(state.currentScreen) && state.currentScreen !== 'register';
    const navHtml = showNav ? renderNavBar() : '';
    
    const blobsHtml = `
        <div class="bg-blobs">
            <div class="blob blob-1"></div>
            <div class="blob blob-2"></div>
        </div>
    `;
    
    app.innerHTML = blobsHtml + screenHtml + navHtml;
    
    // Initialize Lucide icons
    lucide.createIcons();
}

// --- Funções de Registro ---
window.completeRegistration = async function() {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const pin = document.getElementById('register-pin').value.trim();
    const pinConfirm = document.getElementById('register-pin-confirm').value.trim();

    if (!name) {
        showToast('Por favor, informe seu nome.', 'warning');
        return;
    }
    if (!email) {
        showToast('Por favor, informe seu email.', 'warning');
        return;
    }
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        showToast('O PIN deve ter exatamente 4 dígitos numéricos.', 'warning');
        return;
    }
    if (pin !== pinConfirm) {
        showToast('Os PINs não coincidem. Tente novamente.', 'error');
        return;
    }

    // Salvar dados do usuário
    state.user = { name, email };
    await database.set('user', JSON.stringify(state.user));

    // Configurar segurança com o PIN
    state.security = {
        enabled: true,
        pin: pin,
        isLocked: false
    };
    await database.set('security', JSON.stringify(state.security));

    // Marcar como registrado
    await database.set('user_registered', 'true');
    await database.set('wallets', JSON.stringify(state.wallets));
    await database.set('app_initialized_v2', 'true');

    showToast(`Bem-vindo, ${name}! 🎉`, 'success');
    navigate('dashboard');
}

window.showChangePinInline = function() {
    showToast('Use a opção "Alterar PIN" acima para redefinir.', 'info');
}

// Start
document.addEventListener('DOMContentLoaded', async () => {
    await initState();
    await restoreDraft();
    render();
});
