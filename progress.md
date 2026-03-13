# Progresso: Carteira Digital Antigravity

## Log de Sessão
- **[2024-05-22 10:00]**: Início do projeto.
- **[2024-05-22 20:00]**: Decisão de migrar para SQLite para melhor portabilidade como App.
- **[2024-05-22 20:10]**: Instalado `@capacitor-community/sqlite` e sincronizado projeto.
- **[2024-05-22 20:15]**: Criado `database.js` com suporte a SQLite e fallback para Web.
- **[2024-05-22 20:20]**: Integrado SQLite no fluxo de inicialização do `app.js`.

## Próximos Passos
- Refatorar funções de salvar transação para usar INSERT individual em vez de salvar o array inteiro (Otimização SQL).
- Implementar relatórios SQL (SOMA por categoria, saldo por carteira via QUERY).
