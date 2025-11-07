# Aplicación Node.js con Docker y PostgreSQL

Este es un ejemplo de una aplicación Node.js usando Express, Docker y PostgreSQL. Incluye configuración para desarrollo y producción.

## Requisitos Previos

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)
- [Node.js](https://nodejs.org/) (opcional, solo para desarrollo local)
- `curl` o cliente HTTP (para probar endpoints)

## Instalación

### 1. Clonar el repositorio
git clone https://github.com/MatiasBV/analisis-y-diseno-de-software.git  
(debe tener docker-desktop abierto en todo momento)
Ejecutar en terminal:

1. Deben navegar hasta la carpeta analisis-y-diseno-de-software/mi-proyecto-node-docker  

2. (les instalará las dependencias se suele demorar un poco la primera vez con esto levantan el proyecto)  
docker compose up --build

(para detener los contenedores)  
docker compose down -v

si no les ejecuta asegurense de estar en la carpeta correcta  
si trabajan desde windows deben tener instalado WSL2 y tenerlo activado en docker desktop  
esto se puede verificar en  
Configuración   
-Resources  
  -Configure which WSL 2 distros you want to access Docker from. (esto debe estar activo)  
  -Enable integration with additional distros:(esto debe estar activo)  

# Comandos útiles 

Pueden levantar el proyecto sin volver a construir las imágenes con el siguiente comando:
  - docker compose up
Si quieren levantar el proyecto en segundo plano pueden usar:
  - docker compose up -d
Para ver el estado de los servicios que están corriendo:
  - docker compose ps
Para ver los logs en tiempo real de todos los servicios:
  - docker compose logs -f
O de un servicio específico:
  - docker compose logs -f nombre_servicio
Para reiniciar un servicio específico:
  - docker compose restart nombre_servicio
Para detener todos los contenedores sin eliminar volúmenes:
  - docker compose down




## HU001 – Simular Préstamo (React + Node + PostgreSQL)

Este hito agrega un simulador de préstamos realista, integrado a la página existente pero implementado con React en el front y Node.js + PostgreSQL en el back.

## ¿Qué se agregó?
- Componente React embebido que permite simular un préstamo directamente en la sección "Simula Tu Préstamo Ideal".
- Cálculo bancario realista:
  - Tasa anual nominal (TNA) por tramos según monto y plazo; convertida a tasa efectiva mensual.
  - Comisión de apertura financiada (1.2%), cargo fijo mensual y seguro mensual sobre saldo.
  - Cuadro de amortización mensual completo (interés, amortización, seguro, cargo, pago, saldo).
  - CAE (APR) estimada mediante IRR de los flujos.
  - Tarjetas de “opciones rápidas” para comparar distintos plazos.
- API REST para registrar la simulación como solicitud pendiente: `POST /api/loan-requests` (guarda en PostgreSQL).

## Registro de solicitantes
- Nueva página: `GET /register` con formulario para registrarse como solicitante (datos personales, domicilio con comprobante, actividad/ingresos y opcional historial financiero). Valida mayoría de edad (≥18).
- API: `POST /api/applicants` para registrar vía JSON (útil para pruebas o front futuro).
- Las solicitudes de préstamo (`/api/loan-requests`) aceptan opcional `applicantId` para asociar la simulación a un solicitante.

## Archivos modificados/añadidos
- `src/public/js/loanSimulator.js`: Componente React (sin JSX) con lógica de simulación, amortización y envío a la API.
- `src/public/css/styles.css`: Estilos del simulador (`.simulator-*`, `.offer-*`, tabla de amortización) respetando el look & feel existente.
- `src/views/partials/head.ejs`: Carga de React/ReactDOM desde `node_modules` vía `/vendor` y del script del simulador.
- `index.js`: `express.json()`, estático `/vendor` a `node_modules`, y nueva ruta `/api/loan-requests`.
- `src/routes/loanRequests.js`: Nueva ruta para crear solicitudes; crea tabla si no existe.
- `package.json`: Se agrega `react-dom` como dependencia.

## Cómo usar
1. Levantar con Docker (recomendado):
   - `docker compose up --build`
   - Abrir `http://localhost:3000`
2. O sin Docker (requiere PostgreSQL y variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`):
   - `npm install`
   - `npm run dev`
   - `http://localhost:3000`

### Flujo HU001 cubierto
- El cliente ingresa monto y plazo y ve cuota estimada, tasa mensual, desglose de seguros/cargos y totales.
- Puede comparar plazos sugeridos y ver tabla de amortización.
- Al “Confirmar simulación”, se registra una solicitud con estado `PENDING` en la base de datos.

### Página dedicada del simulador
- Nueva ruta `GET /simulator` que muestra el simulador en una página propia además de la sección de la home.

Notas: Los parámetros de tasas, comisión, seguro y cargo fijo son configurables en `loanSimulator.js` para iterar rápidamente con el equipo.

Para levantar los servicios del Docker recordar:

docker-compose up -d

Haciendo simplemente eso ya podemos usar la pagina.

## HU002 – Monitorear el Estado de mi Solicitud de Préstamo (Node.js + PostgreSQL + Worker)

Este hito implementa el monitoreo del estado de las solicitudes de préstamo, incluyendo la actualización de estado, la generación de eventos y el envío simulado de notificaciones a través de un *worker* interno.

---

### ¿Qué se agregó?
- **Endpoints REST** para consultar y actualizar el estado de las solicitudes:
  - `GET /api/loan-requests?applicantId=1` → lista solicitudes por usuario.
  - `GET /api/loan-requests/:id/status` → obtiene el estado actual y posibles próximas acciones.
  - `PATCH /api/loan-requests/:id/status` → cambia el estado y encola una notificación.
  - `GET /api/loan-requests/:id/timeline` → devuelve el historial de eventos asociados.
- **Worker de notificaciones (notificationWorker.js)**:
  - Procesa periódicamente las notificaciones encoladas.
  - Inserta en la tabla `loan_request_events` el evento `NOTIFICATION_SENT`.
  - Actualiza el estado de la notificación a `SENT`.
- **Eventos automáticos registrados en base de datos:**
  - `STATE_CHANGED` → al modificar el estado.
  - `NOTIFICATION_SENT` → cuando el worker procesa la notificación.

---

### Cambios en la base de datos
- Script de inicialización `db/init/001_hu002.sql`:
  - Crea el tipo `ENUM loan_status` con valores válidos (`PENDING_EVAL`, `APPROVED`, `REJECTED`, `CONTRACT_PENDING`, `CONTRACT_SIGNED`, `ACTIVE`, `DISBURSED`).
  - Tablas adicionales:
    - `loan_request_events` → registro histórico de cambios y notificaciones.
    - `notifications` → cola de mensajes pendientes/enviados.
  - Trigger `on_lr_state_change` → registra automáticamente un evento `STATE_CHANGED` al actualizar el estado en `loan_requests`.

---

### Archivos modificados / añadidos
- `src/routes/loanStatus.js`  
  Define todos los endpoints HU002 y gestiona el cambio de estado con `::loan_status` y encolado de notificaciones.
- `src/workers/notificationWorker.js`  
  Worker en background que procesa la tabla `notifications`, genera eventos `NOTIFICATION_SENT` y actualiza el estado `SENT`.
- `src/views/requests.ejs`  
  Vista para listar las solicitudes y visualizar el estado actual.
- `src/views/request_detail.ejs`  
  Vista detallada que consulta dinámicamente el estado y línea de tiempo mediante `fetch`.
- `index.js`  
  Se integra el router HU002:
  ```js
  const loanStatusRouterFactory = require('./src/routes/loanStatus');
  app.use('/api', loanStatusRouterFactory(pool));

  Y se inicializa el worker:

  const startNotificationWorker = require('./src/workers/notificationWorker');
  startNotificationWorker(pool);

### Cómo usar

1. Levantar el entorno Docker

   docker compose up -d


2. Crear una solicitud dummy

  Invoke-RestMethod -Uri "http://localhost:3000/api/loan-requests" `
    -Method POST -ContentType "application/json" `
    -Body '{"amount":1000000,"termMonths":12,"monthlyRate":0.02,"monthlyPayment":95000,"applicantId":1}'


3. Consultar estado

  Invoke-RestMethod -Uri "http://localhost:3000/api/loan-requests/1/status" -Method GET


4. Cambiar estado (dispara notificación)

  Invoke-RestMethod -Uri "http://localhost:3000/api/loan-requests/1/status" `
    -Method PATCH -ContentType "application/json" `
    -Body '{"status":"APPROVED"}'


5. Ver timeline

  Invoke-RestMethod -Uri "http://localhost:3000/api/loan-requests/1/timeline" -Method GET


  6. Ver logs

  docker compose logs -f app


  Debe aparecer:

  [NOTIFY] status_changed via EMAIL for LR 1 { newStatus: 'APPROVED' }

### Flujo HU002 cubierto

  - El cliente puede consultar sus solicitudes y ver su estado actual.

  - Al cambiar de estado, se registra un evento STATE_CHANGED y se encola una notificación.

  - El worker procesa las notificaciones y genera NOTIFICATION_SENT.

  - El usuario puede revisar todo el historial en /api/loan-requests/:id/timeline o en la vista /requests/:id.

  Notas

  El worker se ejecuta cada 5 segundos y maneja hasta 20 notificaciones pendientes por ciclo.

  El flujo es completamente autónomo y extensible para nuevos canales (SMS, push, etc).
