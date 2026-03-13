// Antigravity Digital Wallet - App Logic
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
        dueDate: new Date().toISOString().split('T')[0],
        attachment: null
    },
    wallets: [
        { id: 'principal', name: 'Principal', balance: 2450.00, icon: 'wallet', color: '#3b82f6' },
        { id: 'empresa', name: 'Empresa', balance: 12800.50, icon: 'briefcase', color: '#8b5cf6' },
        { id: 'ticket', name: 'Ticket Alimentação', balance: 450.20, icon: 'utensils', color: '#10b981' }
    ],
    transactions: JSON.parse(localStorage.getItem('transactions')) || [
        { id: 1, date: '2024-05-21', description: 'Amazon Prime', amount: -14.90, category: 'Assinaturas', wallet: 'principal', status: 'approved' },
        { id: 2, date: '2024-05-21', description: 'Almoço Executivo', amount: -35.00, category: 'Alimentação', wallet: 'ticket', status: 'pending' },
        { id: 3, date: '2024-05-20', description: 'Transferência Recebida', amount: 500.00, category: 'Renda', wallet: 'principal', status: 'approved' },
        { id: 4, date: '2024-05-19', description: 'Uber Viagem', amount: -22.50, category: 'Transporte', wallet: 'empresa', status: 'approved' },
        { id: 5, date: '2024-05-18', description: 'Hotel Ibis', amount: -320.00, category: 'Viagem', wallet: 'empresa', status: 'in_review' }
    ]
};

function saveDraft() {
    try {
        localStorage.setItem('tx_draft', JSON.stringify({
            currentScreen: state.currentScreen,
            inputState: state.inputState
        }));
    } catch(e) {
        localStorage.setItem('tx_draft', JSON.stringify({
            currentScreen: state.currentScreen,
            inputState: { ...state.inputState, attachmentUrl: null, attachment: null }
        }));
    }
}

function restoreDraft() {
    try {
        const draft = JSON.parse(localStorage.getItem('tx_draft'));
        if (draft && draft.currentScreen === 'addTransaction') {
            state.currentScreen = draft.currentScreen;
            if (draft.inputState) state.inputState = { ...state.inputState, ...draft.inputState };
        }
    } catch(e) {}
}

restoreDraft();

// --- Core Functions ---

function setState(newState) {
    Object.assign(state, newState);
    render();
}

function navigate(screen) {
    state.prevScreen = state.currentScreen;
    if (screen === 'addTransaction') {
        state.inputState = { 
            type: 'expense',
            amount: '0', 
            description: '', 
            wallet: 'principal', 
            category: 'Alimentação',
            paid: true,
            dueDate: new Date().toISOString().split('T')[0],
            attachment: null
        };
    } else {
        localStorage.removeItem('tx_draft');
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

function saveTransaction(event) {
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
        date: new Date().toISOString().split('T')[0],
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
    localStorage.setItem('transactions', JSON.stringify(updatedTransactions));
    localStorage.removeItem('tx_draft');
    
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
            reader.onload = (evt) => {
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
                reader.onload = (evt) => {
                    const originalTx = { ...state.transactions[txIndex] };
                    state.transactions[txIndex].hasAttachment = true;
                    state.transactions[txIndex].attachmentUrl = evt.target.result;
                    
                    try {
                        localStorage.setItem('transactions', JSON.stringify(state.transactions));
                    } catch(err) {
                        alert('A imagem é muito grande para ser salva no armazenamento do navegador.');
                        // revert
                        state.transactions[txIndex] = originalTx;
                    }
                    render();
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
    dashboard: () => `
        <div class="content-area animate-in">
            <header style="margin-bottom: 32px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <p class="caption">Bem-vindo,</p>
                    <h1 class="h1">João Silva</h1>
                </div>
                <div class="glass" style="width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid var(--accent-blue);">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Avatar" style="width: 100%;">
                </div>
            </header>

            <section style="margin-bottom: 32px; overflow-x: auto; display: flex; gap: 16px; padding: 4px; padding-bottom: 12px; scrollbar-width: none; -ms-overflow-style: none;">
                ${state.wallets.map(w => `
                    <div class="glass-card" style="min-width: 170px; flex-shrink: 0; background: linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%);">
                        <div style="background: ${w.color}11; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                            ${icon(w.icon, w.color, 20)}
                        </div>
                        <p class="caption">${w.name}</p>
                        <h2 class="amount" style="margin-top: 4px; font-size: 22px;">R$ ${w.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
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
                                ${t.amount < 0 ? '-' : ''} R$ ${Math.abs(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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

    extract: () => `
        <div class="content-area animate-in">
            <h1 class="h1" style="margin-bottom: 24px;">Extrato</h1>
            
            <div style="display: flex; gap: 8px; margin-bottom: 32px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none;">
                <div class="glass" style="padding: 10px 20px; border-radius: 20px; font-size: 14px; background: var(--accent-blue); border-color: transparent; white-space: nowrap;">Maio 2024</div>
                <div class="glass" style="padding: 10px 20px; border-radius: 20px; font-size: 14px; white-space: nowrap;">Abril 2024</div>
                <div class="glass" style="padding: 10px 20px; border-radius: 20px; font-size: 14px; white-space: nowrap;">Filtros</div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 32px;">
                ${['2024-05-21', '2024-05-20', '2024-05-19', '2024-05-18'].map(date => {
                    const txs = state.transactions.filter(t => t.date === date);
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
    `,

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
                <p class="caption" style="color: rgba(255,255,255,0.8)">Total Aprovado para Reembolso</p>
                <h1 class="amount" style="font-size: 32px; margin: 8px 0; color: white;">
                    R$ ${approved.reduce((acc, t) => acc + Math.abs(t.amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h1>
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
            
            <button class="btn btn-primary" style="width: 100%; margin-top: 32px;" onclick="alert('Relatórios exportados para o RH!')">
                Exportar Relatório PDF
            </button>
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
                <div style="width: 40px;"></div>
            </header>

            <div style="background: white; border-radius: 24px; padding: 32px 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.05); position: relative; overflow: hidden;">
                <!-- Subtle background watermark/pattern could go here -->
                
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-blue); display: flex; align-items: center; justify-content: center;">
                        ${icon('check', 'white', 16)}
                    </div>
                    <span style="font-weight: 700; font-size: 16px; color: var(--text-primary);">Comprovante de ${tx.amount < 0 ? 'pagamento' : 'recebimento'}</span>
                </div>
                <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 32px;">${formattedDate} às 10:33</p>
                
                <div style="margin-bottom: 32px;">
                    <p style="font-weight: 700; font-size: 16px; text-transform: uppercase; color: var(--text-primary); letter-spacing: 0.5px; margin-bottom: 4px;">${tx.description}</p>
                    <h1 style="font-size: 36px; font-weight: 800; color: var(--text-primary); margin: 0; line-height: 1;">
                        R$ ${Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h1>
                </div>

                <hr style="border: none; border-top: 1px dashed rgba(0,0,0,0.1); margin: 24px 0;">

                <div style="display: flex; flex-direction: column; gap: 24px;">
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
                
                <div style="margin-top: 40px;">
                    <p style="font-weight: 600; font-size: 14px; margin-bottom: 16px;">Comprovante Anexado</p>
                    ${tx.hasAttachment && tx.attachmentUrl ? `
                        <div style="border-radius: 16px; overflow: hidden; border: 1px solid rgba(0,0,0,0.1); position: relative; background: #f9fafb; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 160px; background-image: url('${tx.attachmentUrl}'); background-size: cover; background-position: center;">
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
            
            <button class="glass" style="position: fixed; bottom: 32px; right: 32px; width: 56px; height: 56px; border-radius: 16px; background: var(--accent-purple); color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 25px rgba(139, 92, 246, 0.4); border: none; cursor: pointer; z-index: 10;">
                ${icon('share-2', 'white', 24)}
            </button>
        </div>
        `;
    },

    report: () => `
        <div class="content-area animate-in">
            <h1 class="h1" style="margin-bottom: 24px;">Visão Geral</h1>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;">
                <div class="glass-card" style="text-align: center;">
                    <p class="caption" style="font-size: 12px;">Entradas</p>
                    <p class="amount" style="color: var(--success); font-size: 20px;">R$ 5.200</p>
                </div>
                <div class="glass-card" style="text-align: center;">
                    <p class="caption" style="font-size: 12px;">Saídas</p>
                    <p class="amount" style="color: var(--error); font-size: 20px;">R$ 3.850</p>
                </div>
            </div>

            <h2 class="h2" style="margin-bottom: 16px;">Distribuição</h2>
            <div class="glass-card" style="display: flex; flex-direction: column; gap: 20px;">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div class="glass" style="width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: rgba(59, 130, 246, 0.1);">
                        ${icon('shopping-cart', 'var(--accent-blue)', 20)}
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-weight: 500; font-size: 14px;">Compras</span>
                            <span class="caption" style="font-size: 12px;">40%</span>
                        </div>
                        <div style="height: 6px; background: rgba(0,0,0,0.05); border-radius: 3px; overflow: hidden;">
                            <div style="width: 40%; height: 100%; background: var(--accent-blue);"></div>
                        </div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div class="glass" style="width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: rgba(139, 92, 246, 0.1);">
                        ${icon('coffee', 'var(--accent-purple)', 20)}
                    </div>
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-weight: 500; font-size: 14px;">Alimentação</span>
                            <span class="caption" style="font-size: 12px;">25%</span>
                        </div>
                        <div style="height: 6px; background: rgba(0,0,0,0.05); border-radius: 3px; overflow: hidden;">
                            <div style="width: 25%; height: 100%; background: var(--accent-purple);"></div>
                        </div>
                    </div>
                </div>
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
            <div class="nav-item" onclick="alert('Perfil em breve!')">
                ${icon('user', 'var(--text-secondary)')}
                <span>Perfil</span>
            </div>
        </nav>
    `;
}

function render() {
    const app = document.getElementById('app');
    const screenHtml = Screens[state.currentScreen]();
    
    const showNav = ['dashboard', 'extract', 'report', 'accountability'].includes(state.currentScreen);
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

// Start
document.addEventListener('DOMContentLoaded', () => {
    render();
});
