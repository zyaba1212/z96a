# Пошаговые команды для деплоя на сервер

**Сервер:** `178.172.138.162`  
**Локальный проект:** `c:\z96a` (или `c:\telegram-solana-client` — подставьте свой путь)

---

## 1. Подготовка на локальной машине (Windows)

### 1.1 Закоммитить и отправить изменения в Git (если используете)

```powershell
cd c:\z96a
git add .
git commit -m "Deploy: latest changes"
git push origin main
```

Если ветка другая — замените `main` на свою (например `master`).

---

## 2. Подключение к серверу по SSH

### 2.1 Подключиться к серверу

```bash
ssh root@178.172.138.162
```

Либо с указанием пользователя (если не root):

```bash
ssh your_username@178.172.138.162
```

При запросе введите пароль от сервера.

### 2.2 (Рекомендуется) Настроить вход по SSH-ключу, чтобы не вводить пароль

На **Windows** в PowerShell:

```powershell
# Проверить, есть ли ключ
cat $env:USERPROFILE\.ssh\id_rsa.pub

# Если ключа нет — создать
ssh-keygen -t ed25519 -C "your_email@example.com" -f $env:USERPROFILE\.ssh\id_ed25519 -N '""'
cat $env:USERPROFILE\.ssh\id_ed25519.pub
```

Скопировать вывод `id_ed25519.pub` (или `id_rsa.pub`). На **сервере** после входа по паролю:

```bash
mkdir -p ~/.ssh
echo "ВСТАВЬТЕ_СЮДА_ВАШ_ПУБЛИЧНЫЙ_КЛЮЧ" >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

После этого можно подключаться без пароля: `ssh root@178.172.138.162`.

---

## 3. На сервере: обновление кода и зависимостей

### 3.1 Перейти в каталог проекта

Если проект уже склонирован (подставьте свой путь):

```bash
cd /var/www/z96a
# или, например:
# cd /home/your_username/telegram-solana-client
```

Если проект ещё не развёрнут — клонировать репозиторий:

```bash
cd /var/www
git clone https://github.com/YOUR_USER/YOUR_REPO.git z96a
cd z96a
```

### 3.2 Забрать последние изменения из Git

```bash
git pull origin main
```

### 3.3 Установить зависимости Node.js

```bash
npm ci
```

Если нет `package-lock.json` или нужна гибкая установка:

```bash
npm install
```

### 3.4 Сгенерировать Prisma Client и применить схему БД

```bash
npx prisma generate
npx prisma db push
```

Для продакшена с миграциями вместо `db push`:

```bash
npx prisma migrate deploy
```

### 3.5 Собрать Next.js

```bash
npm run build
```

---

## 4. Запуск приложения на сервере

### Вариант A: через PM2 (рекомендуется)

Установка PM2 (один раз):

```bash
npm install -g pm2
```

Запуск/перезапуск:

```bash
cd /var/www/z96a
pm2 delete z96a 2>/dev/null; pm2 start npm --name z96a -- start
pm2 save
pm2 startup
```

Просмотр логов:

```bash
pm2 logs z96a
```

### Вариант B: через systemd

Создать unit-файл:

```bash
sudo nano /etc/systemd/system/z96a.service
```

Содержимое (подставьте путь и пользователя):

```ini
[Unit]
Description=Z96a Next.js App
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/z96a
ExecStart=/usr/bin/npm start
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

Включить и запустить:

```bash
sudo systemctl daemon-reload
sudo systemctl enable z96a
sudo systemctl restart z96a
sudo systemctl status z96a
```

### Вариант C: разовый запуск (для проверки)

```bash
cd /var/www/z96a
NODE_ENV=production npm start
```

Приложение будет на порту 3000. Для выхода — Ctrl+C.

---

## 5. Переменные окружения на сервере

Убедитесь, что на сервере есть `.env` в корне проекта с нужными переменными, например:

```bash
nano /var/www/z96a/.env
```

Минимум для Prisma и приложения:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
```

Сохранить (в nano: Ctrl+O, Enter, Ctrl+X).

---

## 6. Nginx как обратный прокси (опционально)

Если нужен домен и HTTPS:

```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y
sudo nano /etc/nginx/sites-available/z96a
```

Пример конфига:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Включить сайт и получить сертификат:

```bash
sudo ln -s /etc/nginx/sites-available/z96a /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com
```

---

## Краткая шпаргалка (только команды)

**Локально (PowerShell):**
```powershell
cd c:\z96a
git add . && git commit -m "Deploy" && git push origin main
```

**На сервере (после `ssh root@178.172.138.162`):**
```bash
cd /var/www/z96a
git pull origin main
npm ci
npx prisma generate
npx prisma db push
npm run build
pm2 restart z96a
```

Пароль от сервера вводите только при запросе SSH, в команды его подставлять не нужно.
