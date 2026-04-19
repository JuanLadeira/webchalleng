FROM python:3.12-slim AS builder

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml .
RUN uv pip install --system -e "."

# ---- runtime ----
FROM python:3.12-slim

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY . .

RUN printf '#!/bin/bash\nset -e\necho "→ Rodando migrations..."\nalembic upgrade head\necho "→ Iniciando servidor..."\nexec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2\n' > /entrypoint.prod.sh \
    && chmod +x /entrypoint.prod.sh

ENTRYPOINT ["/entrypoint.prod.sh"]
