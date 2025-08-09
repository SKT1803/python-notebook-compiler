FROM python:3.11-slim
ENV PIP_NO_CACHE_DIR=1 MPLBACKEND=Agg PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends build-essential gcc g++ \
 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir \
    numpy pandas scipy scikit-learn \
    matplotlib seaborn pillow \
    requests beautifulsoup4 lxml \
    pyarrow openpyxl
CMD ["python","-V"]
