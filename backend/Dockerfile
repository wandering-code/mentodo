FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Las migraciones se aplican solas al arrancar: así un `up --build` en el mini PC
# nunca deja el código nuevo corriendo contra un esquema viejo.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
