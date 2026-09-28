# Pide Fácil

Sistema para restaurantes: mesas, cocina, pedidos a domicilio por enlace y por WhatsApp, repartidores y cuadre de caja.

| Carpeta | Qué es | Tecnología |
|---|---|---|
| `frontend/` | Panel del restaurante, menú en línea para clientes y pantalla del repartidor | Angular 21, Tailwind |
| `backend/` | API, tiempo real (WebSocket) y cola de mensajes de WhatsApp | Spring Boot 4.1, Java 21, PostgreSQL, Flyway |

## Poner a andar en local

### Backend

1. Copia `backend/.env.example` a `backend/.env` y llena los valores (base de datos, llaves JWT y del bot, URL del servicio de WhatsApp).
2. Levántalo:

   ```bash
   cd backend
   ./mvnw spring-boot:run
   ```

   Queda en `http://localhost:8080`. Las migraciones de la base (`src/main/resources/db/migration`) corren solas al arrancar.

3. Pruebas unitarias (no necesitan base de datos):

   ```bash
   ./mvnw test -Dtest='!OmnirestBackendApplicationTests' -Dsurefire.failIfNoSpecifiedTests=false
   ```

### Frontend

```bash
cd frontend
npm install
npx ng serve
```

Queda en `http://localhost:4200`. Las URLs del backend están en `src/environments/`.

## Antes de publicar

- En `frontend/src/environments/environment.prod.ts` pon tus dominios reales (`apiUrl`, `publicApiUrl`) y en `publicAppUrl` el dominio donde los clientes abren el menú.
- Nunca subas `backend/.env` ni archivos de ngrok con tokens: ya están en `.gitignore`.
