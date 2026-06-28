# 💈 TMA Barbershop — Telegram Mini App для записи в барбершоп

Готовое решение для записи клиентов к барберам через Telegram Mini App.  
Всё работает через Telegram — бот, уведомления, регистрация мастеров.

## Как это выглядит

**Клиент:**
1. Открывает Mini App через Telegram → выбирает мастера, услугу, дату и время
2. Получает подтверждение записи в Telegram
3. Напоминание за день и за час до записи

**Мастер:**
1. Получает ссылку-приглашение от админа → переходит → регистрируется (данные из Telegram)
2. Управляет своими услугами, расписанием, особыми датами
3. Видит все записи, может отменять
4. Получает уведомления о новых записях

**Админ:**
1. Полный CRUD мастеров, услуг, броней
2. Создаёт инвайт-ссылки для регистрации мастеров
3. Привязывает услуги к мастерам (со своей ценой и длительностью)
4. Управляет расписанием мастеров

## Стек

- **Backend:** Python / FastAPI + SQLAlchemy + SQLite
- **Frontend:** React 19 + Vite 8
- **Telegram:** Bot API (webhook + Mini App)
- **HTTPS:** Cloudflare Tunnel (бесплатно)
- **Deploy:** Любой VPS (2‑ядерный, 2 ГБ RAM — хватит с запасом)

## Быстрый старт

### 1. Клонировать

```bash
git clone https://github.com/Timfeyka/tma-barbershop.git
cd tma-barbershop
```

### 2. Создать бота в Telegram

1. Откройте [@BotFather](https://t.me/BotFather)
2. `/newbot` → задайте имя и username → получите **токен**
3. `/mybots` → выберите бота → **Bot Settings** → **Menu Button** → укажите URL вашего приложения (позже)
4. Там же: **Bot Settings** → **Domain** → укажите домен (если есть)

### 3. Настроить окружение

```bash
cp .env.example .env
```

Заполните `.env`:

```env
BOT_TOKEN=1234567890:ABCdefGHIjklmNOPqrstUVwxyz
ADMIN_PASSWORD=мой_надёжный_пароль
DATABASE_URL=sqlite:///./barber.db
```

### 4. Backend

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 5. Frontend

В отдельном терминале:

```bash
cd frontend
npm ci
npm run build
```

### 6. HTTPS (Cloudflare Tunnel)

```bash
# Установите cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:8000
```

Туннель выдаст URL вида `https://sometry.trycloudflare.com`.

### 7. Настроить бота

После запуска:
- Откройте админ-панель: `https://туннель.trycloudflare.com#admin`
- Войдите с паролем из `.env`
- На вкладке **Настройки** нажмите **«Настроить webhook заново»**
- Бот автоматически обновит Menu Button и описание

Готово! 🎉

## Deploy на сервер

Предполагается, что проект лежит в `/opt/tma-barbershop`, а cloudflared установлен.

```bash
cd /opt/tma-barbershop
bash deploy.sh
```

Скрипт: `git pull` → установка зависимостей → сборка фронтенда → запуск uvicorn → запуск туннеля → вывод URL.

## Роли и возможности

### Клиент
- Выбор мастера из списка
- Выбор услуги (у каждого мастера свой набор)
- Календарь на месяц с навигацией
- Доступные слоты по расписанию мастера
- Подтверждение и напоминания в Telegram

### Мастер
- Регистрация по инвайт-ссылке через Telegram
- Просмотр своих записей
- Управление своими услугами
- Настройка расписания (по дням недели)
- Особые даты (выходной, лимит записей)
- Загрузка своего фото
- Уведомления о новых записях

### Админ
- Логин по паролю
- CRUD мастеров
- CRUD услуг
- Создание инвайт-ссылок
- Привязка услуг к мастерам (цена, длительность)
- Управление записями (подтверждение, удаление)
- Настройка webhook

## API

Основа: [FastAPI](http://localhost:8000/docs) — Swagger-документация по умолчанию доступна на `/docs`.

### Основные эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/masters/` | Все мастера |
| POST | `/api/masters/register-by-invite` | Регистрация по инвайту |
| GET | `/api/masters/{id}/services` | Услуги мастера |
| GET | `/api/masters/{id}/schedule` | Расписание мастера |
| PUT | `/api/masters/{id}/schedule` | Сохранить расписание |
| GET | `/api/masters/{id}/date-overrides` | Особые даты мастера |
| PUT | `/api/masters/{id}/date-overrides` | Создать/обновить особую дату |
| PUT | `/api/masters/{id}/photo` | Загрузить фото |
| PUT | `/api/masters/{id}/link-telegram` | Привязать Telegram |
| GET | `/api/services/` | Все услуги |
| GET | `/api/bookings/available-slots/{master_id}/{date}` | Свободные слоты |
| POST | `/api/bookings/` | Создать запись |
| PUT | `/api/bookings/{id}/cancel` | Отменить запись |
| GET | `/api/bookings/master/{master_id}` | Записи мастера |
| POST | `/api/admin/login` | Вход в админку |
| POST | `/api/admin/invite-link` | Создать инвайт |
| POST | `/api/admin/setup-webhook` | Настроить webhook |
| GET | `/api/bot/webhook-status` | Диагностика бота |

## Поддержка

Если нашли баг или есть идея — [создайте issue](https://github.com/Timfeyka/tma-barbershop/issues).

---

Сделано с любовью к барберам и их клиентам ✂️💈
