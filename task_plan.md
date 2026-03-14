# Plano de Correições - Carteira App

## Problemas Identificados

### 1. Fluxo de Primeiro Acesso (CRÍTICO)
- **Problema**: App inicia no Dashboard direto, sem tela de registro
- **Esperado**: 1º acesso → Registro (nome/email/PIN) → Dashboard. Acessos seguintes → Login via PIN/biometria
- **Causa**: `initState()` não verifica se é primeiro acesso real, apenas se `app_initialized_v2` existe

### 2. Perfil não permite alterar dados de acesso
- **Problema**: Tela de perfil não tem opção de alterar nome/email/PIN de forma integrada
- **Esperado**: Seção na tela de perfil com todos os campos editáveis

### 3. Bug de Fuso Horário nas Datas
- **Problema**: Entrada às 22:04 de 13/03 → registrada como 14/03 10:04
- **Causa**: `new Date().toISOString().split('T')[0]` usa UTC, não horário local
- **Fix**: Usar formatação local para a data

## Fases

### Fase 1: Fix do Fuso Horário [in_progress]
- Corrigir `saveTransaction()` linha 391 - data usa UTC
- Corrigir `navigate()` linha 340 - dueDate default usa UTC
- Corrigir `payTransaction()` linha 493 - data usa UTC

### Fase 2: Tela de Primeiro Registro [pending]
- Criar tela `Screens.register` 
- No `initState()`, verificar se user já tem registro completo
- Se não tem → redirecionar para registro
- Registro salva dados + força setup de PIN

### Fase 3: Melhorar Perfil [pending]
- Adicionar campo para alterar PIN no perfil
- Melhorar layout dos campos editáveis
