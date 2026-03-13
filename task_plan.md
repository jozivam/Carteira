# Plano de Tarefas: Carteira Digital Antigravity (Versão Evoluída)

## Objetivo
Desenvolver uma aplicação de carteira digital completa e visualmente impactante, focada na separação de fluxos financeiros (Pessoal, Corporativo, Benefício) e na facilidade de prestação de contas.

## Fase Atual
Fase 4: Lógica e Navegação (Evolução dos Requisitos)

## Fases do Projeto

### Fase 1: Base e Estética (Concluída 🚀)
- [x] Criação do Sistema de Design (CSS Vanilla) com Glassmorphism.
- [x] Container principal e navegação SPA básica.
- [x] Dashboard Inicial com cartões de saldo.
- [x] Teclado Numérico Customizado para entrada de valores.

### Fase 2: Gestão Multi-Carteira e Agendamento (Em Andamento 🛠️)
- [x] Implementar IDs de Carteira (Principal, Empresa, Ticket).
- [ ] Adicionar fluxo de **Agendamento** (Pendente vs Pago).
- [ ] Implementar campos de `data_vencimento` e `status` nas transações.
- [ ] Criar alerta visual para contas próximas ao vencimento.

### Fase 3: Módulo de Comprovantes e OCR (Próximo 📸)
- [ ] Adicionar campo `url_foto` e simular captura de imagem (placeholder).
- [ ] Criar indicador de `comprovante_pendente` para transações corporativas.
- [ ] Simular extração de dados (data/valor) via OCR mock.

### Fase 4: Prestação de Contas e Relatórios (Próximo 📊)
- [ ] Criar tela específica para a carteira "Adiantamento/Empresa".
- [ ] Implementar filtros por categoria e status de conciliação.
- [ ] Adicionar funcionalidade de "Exportar Relatório" (Simulação de PDF/CSV).

### Fase 5: Segurança e Refinamento Final (Finalização ✨)
- [ ] Adicionar tela de bloqueio (Pin/Biometria mock).
- [ ] Otimizar UX de swipe e micro-interações.
- [ ] Garantir suporte Offline First (localStorage robusto).

## Estrutura de Dados (State)
```javascript
{
    wallets: [
        { id: 'principal', name: 'Principal', type: 'pessoal', balance: 0 },
        { id: 'empresa', name: 'Adiantamento', type: 'corporativo', balance: 0 },
        { id: 'ticket', name: 'Ticket', type: 'beneficio', balance: 0 }
    ],
    transactions: [
        { 
            id: UUID, 
            description: String, 
            amount: Decimal, 
            date: Date, 
            due_date: Date,
            status: 'pending' | 'paid',
            wallet_id: String,
            category: String,
            photo_url: String,
            needs_receipt: Boolean
        }
    ]
}
```

## Notas Técnicas
- **Storage:** Usaremos `localStorage` para persistência no protótipo.
- **Rich Aesthetics:** Manter as animações de entrada e o uso de sombras suaves e gradientes.
- **Offline:** O app funcionará totalmente offline via navegador.
