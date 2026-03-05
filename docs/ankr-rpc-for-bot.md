# Ankr RPC для бота (Solana)

## В чём путаница

**Ankr Multichain API** (Advanced API) — отдельный продукт:

- **URL:** `https://rpc.ankr.com/multichain/{key}`
- **Метод:** например `ankr_getTokenPrice` (кастомные методы для цен токенов)

Это **не** тот же эндпоинт, что нужен боту. Бот использует **стандартный Solana JSON-RPC** (`getTransaction`, `getBalance` и т.д.). У Ankr для этого отдельный продукт — **Solana RPC**:

- **URL:** `https://rpc.ankr.com/solana` (публичный) или `https://rpc.ankr.com/solana/{your_token}` (с ключом)
- **Методы:** стандартные Solana: `getTransaction`, `getBalance`, `getAccountInfo` и т.д.

Ошибка `"Failed to parse request"` при вызове multichain с методом `ankr_getTokenPrice` связана с тем, что для бота нужен именно Solana RPC, а не Multichain.

## Что подставлять в SOLANA_RPC_URL

| Цель | URL |
|------|-----|
| Публичный Ankr Solana (без ключа) | `https://rpc.ankr.com/solana` |
| Ankr Solana с ключом (лимиты выше) | `https://rpc.ankr.com/solana/YOUR_ANKR_SOLANA_KEY` |

Ключ для **Solana RPC** берётся в [Ankr RPC — Solana](https://www.ankr.com/rpc/solana/) (отдельно от Multichain/Advanced API).

**Не использовать для бота:** URL вида `https://rpc.ankr.com/multichain/...` — он не заменяет Solana RPC для `getTransaction`/`getBalance`.

## Проверка Ankr Solana RPC через curl

**Публичный (без ключа):**

```bash
curl -s -X POST https://rpc.ankr.com/solana \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"getBalance\",\"params\":[\"11111111111111111111111111111111\"],\"id\":1}"
```

Ожидается ответ с `"result": { "value": ... }` (баланс в lamports), без ошибки parse.

**С ключом:**

```bash
curl -s -X POST "https://rpc.ankr.com/solana/YOUR_ANKR_SOLANA_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"getBalance\",\"params\":[\"11111111111111111111111111111111\"],\"id\":1}"
```

В PowerShell лучше передать JSON одной строкой без лишних `\"` или сохранить тело в файл и использовать `curl ... -d "@body.json"`.

## Что сделать для бота

1. В `.env` на сервере задать **Solana RPC**, а не Multichain:
   - Публичный: `SOLANA_RPC_URL=https://rpc.ankr.com/solana`
   - С ключом: `SOLANA_RPC_URL=https://rpc.ankr.com/solana/ВАШ_КЛЮЧ_SOLANA_RPC`
2. После смены `SOLANA_RPC_URL` — перезапустить бота и при следующей покупке проверить логи на наличие «Цена входа» и отсутствие 401/parse errors.
