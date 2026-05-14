# Sinav Maratonu

Spring Boot tabanli canli sinav API'si. WebSocket ile canli olay yayini, Redis ile event pub/sub destegi vardir.

## Gereksinimler

- Java 17
- Docker Desktop
- Maven Wrapper repo icinde mevcut: `mvnw.cmd`

Windows'ta Java 17 secili degilse komutlari calistirmadan once:

```powershell
$env:JAVA_HOME='C:\Program Files\Java\jdk-17.0.12'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
```

## Docker ile Calistirma

Uygulama ve Redis'i birlikte baslatmak icin:

```powershell
docker compose up --build
```

Arka planda calistirmak icin:

```powershell
docker compose up --build -d
```

Loglari izlemek icin:

```powershell
docker compose logs -f app
```

Servisleri durdurmak icin:

```powershell
docker compose down
```

Redis verisini de silmek icin:

```powershell
docker compose down -v
```

API adresi:

```text
http://localhost:8080
```

Health check:

```text
http://localhost:8080/actuator/health
```

Redis dis portu:

```text
localhost:6379
```

## Lokal Calistirma

Once Redis'i Docker ile baslat:

```powershell
docker compose up -d redis
```

Sonra uygulamayi lokal calistir:

```powershell
.\mvnw.cmd spring-boot:run
```

Testleri calistirmak icin:

```powershell
.\mvnw.cmd test
```

## WebSocket

STOMP endpoint:

```text
ws://localhost:8080/ws
```

Sinav event topic formati:

```text
/topic/exams/{examId}/events
```

Yayinlanan temel event tipleri:

- `EXAM_STARTED`
- `EXAM_EXTENDED`
- `EXAM_FINISHED`
- `PARTICIPANT_JOINED`
- `PARTICIPANT_PROGRESS`
- `PARTICIPANT_FINISHED`

## Temel API Akisi

Sınav olustur:

```http
POST /api/exams
```

Soru ekle:

```http
POST /api/exams/{examId}/questions
```

Katilim link kodu ile sinava katil:

```http
POST /api/exams/join/{joinCode}
```

Sinavi baslat:

```http
POST /api/exams/{examId}/start
```

Sure uzat:

```http
POST /api/exams/{examId}/extend
```

Cevap gonder:

```http
POST /api/exams/participants/{participantId}/answers
```

Canli ilerleme gonder:

```http
POST /api/exams/participants/{participantId}/progress
```

Leaderboard:

```http
GET /api/exams/{examId}/leaderboard
```

## Notlar

- Docker icinde uygulama Redis'e `redis:6379` adresinden baglanir.
- Lokal calistirmada varsayilan Redis adresi `localhost:6379`.
- Spring Boot 3 icin Java 17 gerekir. Java 8 ile derleme/test hatasi alinir.
