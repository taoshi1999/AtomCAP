FROM python:3.12-slim
WORKDIR /srv

ENV PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
ENV PIP_TRUSTED_HOST=mirrors.aliyun.com
ENV UV_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
ENV UV_HTTP_TIMEOUT=120

COPY pyproject.toml ./
RUN pip install --no-cache-dir uv && uv pip install --system -e .
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
