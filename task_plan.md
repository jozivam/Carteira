# Plano de Tarefas - Sprint 3

## Objetivo
Implementar 3 melhorias: agendamentos recorrentes, detalhes/exclusão de vencimentos, biometria real.

## Tarefas

### 1. Agendamentos Recorrentes
- [ ] Adicionar toggle "Recorrente (mensal)" no formulário de novo lançamento
- [ ] Ao salvar transação recorrente, gerar cópias automáticas para os próximos 12 meses
- [ ] Marcar campo `recurring: true` + `recurringGroupId` para agrupar

### 2. Detalhes e Exclusão de Vencimentos
- [ ] Cada card em "Próximos Vencimentos" deve ser clicável → abre detalhes
- [ ] Adicionar botão de excluir na tela de detalhes (já existe `deleteTransaction`)
- [ ] Mostrar se é recorrente nos detalhes

### 3. Biometria Nativa
- [ ] Trocar a simulação (`useBiometrics`) por Web Credential / WebAuthn API
- [ ] Fallback: usar `navigator.credentials.get()` com challenge 
- [ ] Se não suportar, desabilitar o botão

## Status: EM PROGRESSO
