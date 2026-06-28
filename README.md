# 💈 TMA Barbershop — Telegram Mini App для записи в барбершоп

Готовое решение для записи клиентов к барберам через Telegram Mini App.  
Всё работает внутри Telegram — бот, уведомления, регистрация мастеров.

---

## Быстрый старт (за 5 минут)

### 1. Создать бота в Telegram

1. Откройте [@BotFather](https://t.me/BotFather)
2. `/newbot` → задайте имя и username → получите **токен**
3. `/mybots` → Bot Settings → **Menu Button** → укажите URL вашего будущего приложения
4. Там же: **Bot Settings** → **Domain** → укажите домен (если есть)

### 2. Клонировать и настроить

```bash
git clone https://github.com/Timfeyka/tma-barbershop.git
cd tma-barbershop
```

Создайте [backend/.env](backend/.env) из шаблона [.env.example](.env.example) (рядом с [config.py](backend/app/core/config.py)):

```bash
cp .env.example backend/.env
# или создайте вручную:
nano backend/.env
```

```env
BOT_TOKEN=1234567890:ABCdefGHIjklmNOPqrstUVwxyz
ADMIN_PASSWORD=мой_надёжный_пароль
DATABASE_URL=sqlite:///./barber.db
```

### 3. Запустить

```bash
bash deploy.sh
```

Скрипт [deploy.sh](deploy.sh) сам подтянет изменения, установит зависимости, соберёт фронтенд, запустит API и Cloudflare Tunnel.  
Через ~10 секунд получите готовую ссылку вида `https://что-то.trycloudflare.com`.

### 4. Готово! 🎉

- **Mini App:** `https://ссылка-туннеля.trycloudflare.com`
- **Админка:** `https://ссылка-туннеля.trycloudflare.com#admin` (пароль из `.env`)
- **Telegram бот:** уже настроен, можно писать `/start`

Подробнее про [настройку на сервере](#-развёртывание-на-vps) и [использование бота](#-инструкция-использования-бота).

---

## 🎯 Возможности

### Клиент

- Выбирает мастера, услугу, дату и время
- **Календарь с подцветкой** — 🟢 зеленые дни = мастер работает и есть места, 🔴 красные = мастер отдыхает
- Выбор из услуг конкретного мастера (у каждого может быть свой набор и цена)
- Подтверждение записи в Telegram
- Напоминание за день и за 1 час до записи

### Мастер

- **Регистрация по инвайт-ссылке** — администратор создаёт ссылку, мастер переходит по ней, данные (имя, фото) подтягиваются из Telegram
- **Вкладка «Записи»** — всё расписание, отмена записей
- **Вкладка «Услуги»** — какие услуги оказывает (выбирает из общего каталога)
- **Вкладка «График»** — настраивает рабочие дни и часы
- **Вкладка «Даты»** — календарь особых дат (отпуск, отгул, укороченный день с интервалами)
- Уведомления о новых записях (если привязан Telegram)

### Администратор

- Логин по паролю
- **Вкладка «Записи»** — все записи, подтверждение, удаление
- **Вкладка «Мастера»** — создание инвайт-ссылок, управление услугами и расписанием мастеров
- **Вкладка «Услуги»** — создание/редактирование/удаление услуг (цена, категория, длительность)
- Настройка webhook (кнопка «Настроить webhook заново»)

---

## 📱 Инструкция использования бота

### Как клиент записаться

1. Откройте Mini App через Telegram:
   - Напишите боту `/start` → нажмите кнопку **💈 Открыть приложение**
   - Или нажмите **Menu Button** (кнопка снизу слева в чате с ботом)
2. Выберите мастера
3. Выберите услугу
4. В календаре выберите дату:
   - **🟢 Зелёные** — мастер работает, есть свободные окна
   - **🔴 Красные** — мастер отдыхает
   - **Обычные** — мастер работает, но всё занято
5. Выберите свободное время
6. Подтвердите запись — придёт уведомление в Telegram

### Как мастер зарегистрироваться

1. Администратор создаёт инвайт-ссылку в админке (кнопка **➕ Добавить**)
2. Отправляет ссылку мастеру в Telegram
3. Мастер нажимает на ссылку → бот присылает кнопку **🚀 Стать мастером**
4. Мастер нажимает кнопку → открывается Mini App с данными из Telegram (имя, фото)
5. Нажимает **✅ Стать мастером** — готово!
6. В дашборде мастера можно настроить услуги, расписание и особые даты

### Как мастер войти (после регистрации)

1. Откройте Mini App через бота
2. На главном экране нажмите **👤 Я мастер — войти**
3. Если Telegram привязан — нажмите **Войти как {имя}**
4. Откроется дашборд мастера с вкладками

### Как администратор войти

1. Откройте Mini App
2. Кликните 5 раз по заголовку **💈 Барбершоп** → появится админ-панель
3. Введите пароль из `ADMIN_PASSWORD` в [.env](backend/.env)

---

## 🏗️ Архитектура

```
Telegram (клиент) ──→ Cloudflare Tunnel ──→ FastAPI (uvicorn) ──→ SQLite
       │                                                              │
       └── Bot API (webhook) ──────────────────────────────────────────┘
```

| Компонент | Технология | Файлы |
|-----------|-----------|-------|
| Backend | Python / FastAPI | [backend/app/main.py](backend/app/main.py) — точка входа |
| API роуты | FastAPI routers | [masters.py](backend/app/api/endpoints/masters.py), [bookings.py](backend/app/api/endpoints/bookings.py), [admin.py](backend/app/api/endpoints/admin.py), [bot_webhook.py](backend/app/api/endpoints/bot_webhook.py) |
| База данных | SQLite (или PostgreSQL) + SQLAlchemy | [models.py](backend/app/models/models.py) — схемы БД |
| Миграции | Alembic | [alembic/](backend/alembic/) |
| Схемы Pydantic | Валидация | [schemas.py](backend/app/schemas/schemas.py) |
| Frontend | React 19 + Vite 8 + TypeScript | [frontend/src/](frontend/src/) |
| Компоненты | Основные | [BookingFlow.tsx](frontend/src/components/BookingFlow.tsx), [MasterDashboard.tsx](frontend/src/components/MasterDashboard.tsx), [AdminPanel.tsx](frontend/src/components/AdminPanel.tsx) |
| Telegram | Bot API webhook | [bot_webhook.py](backend/app/api/endpoints/bot_webhook.py) |
| Туннель | Cloudflare Tunnel (бесплатно) | [deploy.sh](deploy.sh) |

---

## 🚀 Развёртывание на VPS

### Что нужно

- VPS (2‑ядерный, 2 ГБ RAM — хватит)
- Ubuntu/Debian (или любой Linux с systemd)
- Установленные: `git`, `python3`, `python3-venv`, `nodejs`, `npm`

### 1. Установить cloudflared

```bash
# https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
```

### 2. Склонировать проект

```bash
git clone https://github.com/Timfeyka/tma-barbershop.git /opt/tma-barbershop
cd /opt/tma-barbershop
cp .env.example backend/.env  # или создайте вручную
nano backend/.env  # вставьте BOT_TOKEN, ADMIN_PASSWORD
```

### 3. Настроить systemd-сервисы

Создайте `/etc/systemd/system/barbershop-api.service`:

```ini
[Unit]
Description=TMA Barbershop API (FastAPI + uvicorn)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/tma-barbershop/backend
EnvironmentFile=/opt/tma-barbershop/backend/.env
ExecStart=/opt/tma-barbershop/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Создайте `/etc/systemd/system/barbershop-tunnel@.service`:

```ini
[Unit]
Description=Cloudflare Tunnel for TMA Barbershop (instance %i)
After=barbershop-api.service
BindsTo=barbershop-api.service

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/cloudflared tunnel --url http://localhost:8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable barbershop-api barbershop-tunnel@main
```

### 4. Первый запуск

```bash
bash deploy.sh
```

Скрипт [deploy.sh](deploy.sh) делает всё автоматически:

1. `git pull origin main` — подтягивает последнюю версию
2. Устанавливает Python-зависимости
3. Собирает фронтенд (`npm ci && npm run build`)
4. Запускает/перезапускает systemd-сервисы
5. Извлекает URL туннеля
6. Обновляет `BASE_URL` в `.env` и перезапускает API с новым URL
7. Настраивает Menu Button бота
8. Регистрирует webhook (с повторными попытками — туннелю нужно время)

### Деплой обновлений

```bash
cd /opt/tma-barbershop && bash deploy.sh
```

После деплоя админка доступна по адресу `https://новый-туннель.trycloudflare.com#admin`.

---

## 🔧 API

Swagger-документация: `https://ваш-домен/api/docs` (встроенная).

### Мастера

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/masters/` | Все мастера |
| GET | `/api/masters/{id}` | Конкретный мастер |
| POST | `/api/masters/` | Создать мастера |
| PUT | `/api/masters/{id}/link-telegram` | Привязать Telegram ID |
| POST | `/api/masters/register-by-invite` | Регистрация по инвайту |

### Услуги мастера

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/masters/{id}/services` | Услуги мастера |
| PUT | `/api/masters/{id}/schedule` | Сохранить расписание |
| GET | `/api/masters/{id}/schedule` | Расписание мастера |
| GET | `/api/masters/{id}/date-overrides` | Особые даты мастера |
| PUT | `/api/masters/{id}/date-overrides` | Создать/обновить особую дату |

### Записи

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/bookings/` | Все записи |
| POST | `/api/bookings/` | Создать запись |
| GET | `/api/bookings/master/{id}` | Записи мастера |
| GET | `/api/bookings/available-slots/{master_id}/{date}` | Свободные слоты на дату |
| GET | `/api/bookings/available-days/{master_id}/{year}/{month}` | Статус всех дней месяца (цвета календаря) |
| PUT | `/api/bookings/{id}/cancel` | Отменить запись |
| POST | `/api/bookings/check-reminders` | Отправить напоминания (крон) |

### Админка

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/admin/login` | Вход по паролю |
| GET | `/api/admin/masters` | Все мастера (с данными) |
| DELETE | `/api/admin/masters/{id}` | Удалить мастера |
| PUT | `/api/admin/masters/{id}` | Обновить мастера |
| GET | `/api/admin/services` | Все услуги |
| POST | `/api/admin/services` | Создать услугу |
| PUT | `/api/admin/services/{id}` | Редактировать услугу |
| DELETE | `/api/admin/services/{id}` | Удалить услугу |
| POST | `/api/admin/invite-link` | Создать инвайт-ссылку |
| POST | `/api/admin/masters/{id}/services` | Привязать услугу мастеру |
| DELETE | `/api/admin/masters/{id}/services/{ms_id}` | Отвязать услугу |
| GET | `/api/admin/bookings` | Все записи (админ) |
| PUT | `/api/admin/bookings/{id}/confirm` | Подтвердить запись |
| POST | `/api/admin/setup-webhook` | Настроить webhook |
| GET | `/api/admin/bot-info` | Статус бота |

### Бот

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/bot/webhook` | Webhook Telegram (приём сообщений) |
| GET | `/api/bot/webhook-status` | Диагностика webhook |

### Прочее

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/health` | Healthcheck |

---

## 🔄 Хронология изменений

Список ключевых доработок:

- **Инвайт-ссылки** — регистрация мастеров через Telegram одной кнопкой
- **Свои услуги** — у каждого мастера свой набор услуг (с ценой и длительностью)
- **Расписание** — гибкий график по дням недели, интервалы слотов
- **Особые даты** — выходные, отпуск, несколько временных интервалов в день
- **Календарь с подцветкой** — зелёные/красные дни для клиентов при выборе даты
- **Photo URL из Telegram** — фото мастера подтягивается автоматически
- **Уведомления** — мастеру о записи, клиенту о подтверждении и напоминания
- **BackgroundTasks** — отправка уведомлений в фоне, клиент не ждёт ответа Telegram
- **Webhook с retry** — повторные попытки регистрации webhook (туннель не сразу готов)
- **CRUD услуг** — администратор создаёт/редактирует/удаляет услуги из админки

---

## 🔑 Cron для напоминаний

Добавьте в crontab (`crontab -e`):

```
0 * * * * curl -s https://ваш-домен/api/bookings/check-reminders > /dev/null 2>&1
```

Каждый час проверяет записи и отправляет напоминания за день и за час.

---

## Поддержка

Если нашли баг или есть идея — [создайте issue](https://github.com/Timfeyka/tma-barbershop/issues).

---

Сделано с любовью к барберам и их клиентам ✂️💈
