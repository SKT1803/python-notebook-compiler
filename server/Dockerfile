# server/Dockerfile
FROM golang:1.23

WORKDIR /app

COPY go.mod ./
COPY go.sum ./
RUN go mod download

# log, kontrol icin
RUN echo "Dosyalar:" && ls -al /app && echo "GO FILES:" && find . -name "*.go"

# docker komutunu yükle
RUN apt-get update && \
    apt-get install -y docker.io && \
    apt-get clean

COPY . .

# Debug için: main dosyası gerçekten oluşmuş mu?
RUN ls -al /app

RUN go build -o main .

CMD ["./main"]
