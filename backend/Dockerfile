# Stage 1: Сборка фронтенда
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Python бэкенд
FROM python:3.11-slim
WORKDIR /code

# Устанавливаем системные зависимости для psycopg2
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt
RUN pip install --no-cache-dir psycopg2-binary

COPY backend/ .
COPY --from=frontend-builder /app/frontend/dist /code/frontend/dist

ENV FRONTEND_DIST=/code/frontend/dist

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
