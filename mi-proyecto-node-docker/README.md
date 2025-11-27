# Aplicación Node.js con Docker y PostgreSQL

Este es un ejemplo de una aplicación Node.js usando Express, Docker y PostgreSQL. Incluye configuración para desarrollo y producción.

## Requisitos Previos

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)
- [Node.js](https://nodejs.org/) (opcional, solo para desarrollo local)
- `curl` o cliente HTTP (para probar endpoints)

## Instalación

### 1. Clonar el repositorio
`git clone https://github.com/bengoen/GRUPO12-2025-PROYINF`
(debe tener docker-desktop abierto en todo momento)
Ejecutar en terminal:

1. Deben navegar hasta la carpeta GRUPO12-2025-PROYINF/mi-proyecto-node-docker  

2. (les instalará las dependencias se suele demorar un poco la primera vez con esto levantan el proyecto)  
docker compose up --build

(para detener los contenedores)  
docker compose down -v

si no les ejecuta asegurense de estar en la carpeta correcta y que el puerto por defecto 5432 para la base de datos esté libre.  
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

### Cambios en la base de datos
- Script de inicialización `db/init/001_hu002.sql`:
  - Crea el tipo `ENUM loan_status` con valores válidos (`PENDING_EVAL`, `APPROVED`, `REJECTED`, `CONTRACT_PENDING`, `CONTRACT_SIGNED`, `ACTIVE`, `DISBURSED`).
  - Tablas adicionales:
    - `loan_request_events` → registro histórico de cambios y notificaciones.
    - `notifications` → cola de mensajes pendientes/enviados.
  - Trigger `on_lr_state_change` → registra automáticamente un evento `STATE_CHANGED` al actualizar el estado en `loan_requests`.

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
   - docker compose up -d

2. Crear una solicitud
   - Invoke-RestMethod -Uri "http://localhost:3000/api/loan-requests" `
     -Method POST -ContentType "application/json" `
     -Body '{"amount":1000000,"termMonths":12,"monthlyRate":0.02,"monthlyPayment":95000,"applicantId":1}'

3. Consultar estado
   - Invoke-RestMethod -Uri "http://localhost:3000/api/loan-requests/1/status" -Method GET

4. Cambiar estado (dispara notificación)
   - Invoke-RestMethod -Uri "http://localhost:3000/api/loan-requests/1/status" `
    -Method PATCH -ContentType "application/json" `
    -Body '{"status":"APPROVED"}'

5. Ver timeline
   - Invoke-RestMethod -Uri "http://localhost:3000/api/loan-requests/1/timeline" -Method GET

6. Ver logs
   - docker compose logs -f app
   - Debe aparecer:
   - [NOTIFY] status_changed via EMAIL for LR 1 { newStatus: 'APPROVED' }

### Flujo HU002 cubierto
  - El cliente puede consultar sus solicitudes y ver su estado actual.
  - Al cambiar de estado, se registra un evento STATE_CHANGED y se encola una notificación.
  - El worker procesa las notificaciones y genera NOTIFICATION_SENT.
  - El usuario puede revisar todo el historial en /api/loan-requests/:id/timeline o en la vista /requests/:id.

#### Notas
  - El worker se ejecuta cada 5 segundos y maneja hasta 20 notificaciones pendientes por ciclo.
  - El flujo es completamente autónomo y extensible para nuevos canales (SMS, push, etc).


## HU003 – Gestionar la Aprobación y Firma del Préstamo (Contrato + Firma Digital + Préstamos Activos)

Esta HU implementa el flujo completo de formalización del préstamo: desde la revisión del contrato y la firma digital simulada, hasta la visualización de los préstamos activos y sus cuotas.

## ¿Qué se agregó?

- **Contrato web del préstamo**
  - Vista `GET /requests/:id/contract` donde el cliente puede revisar un contrato generado en base a la solicitud de préstamo.
  - El contrato incluye:
    - Datos del cliente (nombre, RUT/RUN, email) asociados al `applicantId` de la solicitud.
    - Monto solicitado, plazo en meses, tasa mensual estimada y cuota mensual.
    - Un cuadro referencial con las primeras cuotas, mostrando capital, interés, pago total y fecha estimada de vencimiento.
  - El cálculo del cuadro de cuotas se realiza en `src/utils/installments.js`, reutilizando la misma lógica de simulación (comisión de apertura financiada, seguro mensual y cargo fijo).

- **Proceso de firma digital (simulado)**
  - Desde el detalle de una solicitud (`GET /requests/:id`) o el listado (`GET /requests`) se habilita el botón **“Revisar y firmar contrato”** cuando el estado del préstamo es `APPROVED` o `CONTRACT_PENDING`.
  - En la vista de contrato (`/requests/:id/contract`):
    - El cliente revisa el texto legal y el resumen del préstamo.
    - Al presionar **“Estoy de acuerdo, continuar a firma digital”**, el front llama a  
      `POST /api/loan-requests/:id/contract/start-sign`, que:
      - Registra un evento `CONTRACT_SENT_TO_SIGNATURE` en la tabla de eventos.
      - Cambia el estado a `CONTRACT_PENDING` (si estaba `APPROVED`).
    - Luego se solicita un código de verificación (simulado, por ejemplo `123456`); al confirmarlo se llama a  
      `POST /api/loan-requests/:id/contract/confirm-sign`, que:
      - Registra los eventos `CONTRACT_SIGNED` y `DISBURSEMENT_STARTED`.
      - Actualiza el estado del préstamo a `ACTIVE`, lo que representa un contrato firmado y el inicio del desembolso.

- **Préstamos activos y cuotas**
  - Nueva vista `GET /my-loans` que lista los préstamos activos del cliente:
    - Se obtiene el `applicantId` del usuario actual desde `localStorage` (configurado en HU004 al registrarse/iniciar sesión).
    - Se consume `GET /api/loan-requests?applicantId=<id>` y se filtran estados `ACTIVE`, `DISBURSED` y `CONTRACT_SIGNED`.
  - Por cada préstamo activo se muestra una tarjeta (card) que incluye:
    - Título con `Préstamo #ID` y monto original solicitado.
    - Estado legible (Activo, Desembolsado, Contrato firmado) con un *badge* de color (verde para activo, azul para estados finalizados).
    - Próximo pago y progreso:
      - Se consulta `GET /api/loan-requests/:id/installments` para obtener el cuadro de cuotas.
      - Se calcula el “próximo pago” como la primera cuota estimada y se muestra como `Próximo pago: $monto el fecha`.
      - Se indica el progreso como texto del estilo `Cuota 1 de N`.
    - Botón **“Ver detalle”** que expande un acordeón con la tabla de amortización, mostrando por cada cuota:
      - Número de cuota.
      - Fecha de vencimiento estimada.
      - Capital.
      - Interés.
      - Total a pagar.
      - Saldo restante.

## Endpoints y vistas clave

- **Vistas**
  - `GET /requests/:id`  
    - Muestra un resumen de la solicitud (estado legible, fecha de última actualización, monto, plazo y cuota) y botones para:
      - “Revisar y firmar contrato” (lleva a `/requests/:id/contract`).
      - “Ver préstamos activos” (lleva a `/my-loans` usando el `applicantId` actual).
  - `GET /requests/:id/contract`  
    - Muestra el contrato legal con resumen del préstamo y guía al usuario por el proceso de firma digital simulada.
  - `GET /my-loans`  
    - Lista las tarjetas de préstamos activos para el solicitante logueado y permite ver el detalle de las cuotas.

- **API (implementadas en `src/routes/loanStatus.js`)**
  - `GET /api/loan-requests/:id/status`  
    - Devuelve `status`, `updated_at` y un arreglo `next_actions` con acciones siguientes sugeridas (por ejemplo `REVIEW_CONTRACT`, `VIEW_INSTALLMENTS`).
  - `GET /api/loan-requests/:id/installments`  
    - Calcula el cuadro de cuotas (capital, interés, seguro, cargo, pago total, saldo restante) a partir de los datos del préstamo y devuelve también un resumen de totales.
  - `POST /api/loan-requests/:id/contract/review`  
    - Registra un evento `CONTRACT_REVIEWED` para auditar que el cliente revisó el contrato.
  - `POST /api/loan-requests/:id/contract/start-sign`  
    - Simula el envío del contrato al proveedor de firma digital y cambia el estado a `CONTRACT_PENDING` cuando corresponde.
  - `POST /api/loan-requests/:id/contract/confirm-sign`  
    - Simula la confirmación de firma digital, registra los eventos de firma y desembolso, y actualiza el estado a `ACTIVE`.

## Archivos modificados/añadidos

- Backend
  - `src/utils/installments.js` → lógica compartida de cálculo de cuotas (usada en el contrato y en “Mis préstamos activos”).  
  - `src/routes/loanStatus.js` → endpoints `status`, `installments` y `contract/*` para HU003.  
  - `index.js` → rutas de vistas `/requests/:id/contract` y `/my-loans`.

- Frontend
  - `src/views/contract.ejs` → contrato web con resumen del préstamo y pasos de firma digital simulada.  
  - `src/views/my_loans.ejs` → tarjetas de préstamos activos del usuario actual, con resumen, próximo pago, progreso y tabla de amortización desplegable.  
  - `src/views/request_detail.ejs` → resumen de la solicitud con estado legible y navegación hacia contrato y préstamos activos.  
  - `src/views/partials/header.ejs` → enlace “Mis Préstamos Activos” en la barra de navegación.

## Cómo usar HU003 desde la página

1. Simular y crear una solicitud (HU001) desde `/simulator` o la sección “Simula tu préstamo ideal” en la home.  
2. Registrar o iniciar sesión (HU004) para asociar la simulación a un solicitante (`applicantId`).  
3. Aprobar la solicitud (HU002) cambiando su estado a `APPROVED` (vía API o botones internos).  
4. Entrar a **“Mis Solicitudes”** (`/requests`), abrir la solicitud (`/requests/:id`) y usar el botón **“Revisar y firmar contrato”** para ir a `/requests/:id/contract`.  
5. Revisar el contrato, continuar a firma digital y confirmar con el código simulado para que el préstamo pase a estado `ACTIVE`.  
6. Ir a **“Mis Préstamos Activos”** (`/my-loans`) para ver las tarjetas de los préstamos activos y, si se desea, desplegar el detalle de cuotas mediante el botón **“Ver detalle”**.



## HU004 – Registro e Inicio de Sesión (Register/Login + Mi Cuenta)

Esta HU agrega un flujo de autenticación básico para solicitantes, con registro usando RUT y contraseña, una sección **“Mi Cuenta”** y la integración de identidad.

### ¿Qué se implementó?

- **Contraseñas seguras:**  
  - Se usa `bcryptjs` para hashear contraseñas en la tabla `applicants`.

- **Registro (`/register`):**
  - Formulario con contraseña y validación.
  - Guarda `applicantId` y `nationalId` en `localStorage` para auto-login.

- **Inicio de sesión y Mi Cuenta (`/login`):**
  - **Login:** Valida RUT y contraseña contra el hash.
  - **Mi Cuenta:** Si ya hay sesión (`localStorage`), muestra el perfil del usuario y botón de "Cerrar sesión".

- **Integración con Solicitudes y Préstamos:**
  - Las vistas `requests.ejs` y `my_loans.ejs` ahora detectan automáticamente el usuario logueado (desde `localStorage`) para filtrar la información y mostrar solo lo que corresponde a ese usuario.

### Resumen del flujo HU004

1. El usuario se registra en `/register` → queda logueado.
2. Entra a **“Mi Cuenta”** (`/login`) → ve sus datos.
3. En **“Mis Solicitudes”** y **“Mis Préstamos”** ve solo su información privada.
```
