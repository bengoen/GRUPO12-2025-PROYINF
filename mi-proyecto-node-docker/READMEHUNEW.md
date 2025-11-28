# HU NEW – Pago de Cuotas con Transbank (Webpay Plus + Node.js + PostgreSQL)

Esta HU agrega el flujo de **pago de la cuota más próxima** de cada préstamo activo utilizando **Transbank Webpay Plus** en ambiente de integración, integrado con la página existente de **“Mis Préstamos Activos”**.

---

## ¿Qué se agregó?

- **Integración con Transbank Webpay Plus (SDK oficial):**
  - Se incorpora la dependencia `transbank-sdk` (versión `^6.1.0`) al proyecto Node.js.
  - Se configura una transacción Webpay Plus en ambiente de **integración** usando los códigos de comercio y API keys de integración (`IntegrationCommerceCodes.WEBPAY_PLUS`, `IntegrationApiKeys.WEBPAY`), con posibilidad de override vía variables de entorno:
    - `TB_ENV` (`INTEGRATION`/`PROD`),
    - `TB_COMMERCE_CODE`,
    - `TB_API_KEY`.

- **Nueva tabla de pagos de cuotas: `loan_installment_payments`**
  - Registra los intentos de pago por Transbank a nivel de **cuota de préstamo**:
    - `id` (PK, `SERIAL`)
    - `loan_request_id` (`INTEGER` FK → `loan_requests.id`)
    - `installment` (`INTEGER`) – número de cuota.
    - `amount` (`NUMERIC(12,2)`) – monto cobrado en CLP.
    - `currency` (`TEXT`, default `CLP`).
    - `status` (`TEXT`) – `INITIATED`, `AUTHORIZED`, `FAILED`, etc.
    - `transbank_token`, `transbank_buy_order`, `transbank_session_id`.
    - `response` (`JSONB`) – respuesta cruda de Transbank (create/commit).
    - `created_at`, `updated_at`, `paid_at`.
  - Índices adicionales:
    - `idx_installments_loan` en `loan_request_id`.
    - `idx_installments_token` en `transbank_token`.
  - La tabla se crea desde el backend mediante `CREATE TABLE IF NOT EXISTS` cuando se invoca la API de pagos por primera vez.

- **Nueva API REST de pagos de cuotas (Transbank):**
  - `POST /api/payments/loans/:id/installments/next`  
    - Determina la **cuota pendiente más próxima** del préstamo `:id` y crea una transacción Webpay Plus.
    - Valida que el préstamo esté en estado **activo**:
      - Acepta estados `ACTIVE`, `DISBURSED`, `CONTRACT_SIGNED`.
    - Construye el cuadro de cuotas usando la misma lógica que HU003 (`buildInstallmentSchedule`).
    - Consulta `loan_installment_payments` para detectar cuotas ya pagadas (`status IN ('AUTHORIZED','PAID')`).
    - Selecciona la cuota pendiente con vencimiento más cercano (posterior o igual a la fecha actual; si todas son pasadas, toma la primera pendiente).
    - Llama a `WebpayPlus.Transaction.create(buyOrder, sessionId, amount, returnUrl)` con:
      - `buyOrder = "LR<loanId>-I<installment>-<timestamp>"`
      - `sessionId = "LR<loanId>-I<installment>"`
      - `amount` = monto redondeado de la cuota (`totalPayment`) en CLP.
      - `returnUrl = <host>/api/payments/commit`.
    - Persiste un registro en `loan_installment_payments` con estado `INITIATED`.
    - Devuelve JSON:
      ```jsonc
      {
        "ok": true,
        "loanId": 1,
        "installment": 3,
        "amount": 123456,
        "token": "token_ws",
        "url": "https://webpay3gint.transbank.cl/webpayserver/initTransaction"
      }
      ```

  - `GET /api/payments/commit`  
  - `POST /api/payments/commit`  
    - Endpoint de **retorno** configurado como `returnUrl` en Webpay (soporta GET y POST).
    - Recibe `token_ws` (o `TBK_TOKEN`) desde Transbank.
    - Busca el registro correspondiente en `loan_installment_payments` usando `transbank_token`.
    - Invoca `WebpayPlus.Transaction.commit(token)` y:
      - Si `response_code === 0` → marca el pago como `AUTHORIZED`, setea `paid_at = NOW()` y guarda la respuesta completa en `response`.
      - En otro caso o si hay excepción → marca el pago como `FAILED`.
    - Renderiza la vista `payment_result.ejs` con un resumen legible del estado del pago y el enlace para volver a **Mis Préstamos Activos**.

- **Extensión de la API de cuotas existente:**
  - `GET /api/loan-requests/:id/installments` (HU003) ahora incorpora información de pagos:
    - Sigue utilizando `buildInstallmentSchedule` para calcular la tabla de cuotas.
    - Intenta leer `loan_installment_payments` para obtener cuotas pagadas; si la tabla aún no existe, continúa sin fallar.
    - Marca cada fila del schedule con `paid: boolean` si la cuota ya está pagada.
    - Calcula `nextInstallment` como la próxima cuota **no pagada** con vencimiento más cercano.
    - Respuesta ahora incluye:
      ```jsonc
      {
        "loan": { ... },
        "schedule": [
          {
            "installment": 1,
            "dueDate": "...",
            "interest": 1234,
            "amortization": 5678,
            "insurance": 90,
            "fee": 1500,
            "totalPayment": 9999,
            "remainingBalance": 123456,
            "paid": false    // nuevo
          }
          // ...
        ],
        "summary": { "totalPaid": ..., "totalInterest": ..., ... },
        "paidInstallments": [1, 2],      // nuevo
        "nextInstallment": 3             // nuevo
      }
      ```

---

## Cambios en el frontend – Mis Préstamos Activos

La vista `src/views/my_loans.ejs` se amplía para ofrecer el flujo de pago de la cuota más próxima desde la sección de **préstamos activos**.

- **Botón “Pagar próxima cuota” en cada préstamo activo**
  - Dentro de cada card de préstamo activo se agrega:
    ```html
    <button class="btn btn-sm btn-primary mb-2 btn-pay-next"
            data-loan-id="${r.id}"
            onclick="payNextInstallment(${r.id}, this)">
      Pagar pr&oacute;xima cuota
    </button>
    ```
  - Solo se muestra para estados activos (`ACTIVE`, `DISBURSED`, `CONTRACT_SIGNED`).

- **Resumen de la próxima cuota usando la nueva API**
  - La función `loadInstallmentsSummary(id)` ahora:
    - Consume `GET /api/loan-requests/:id/installments`.
    - Usa `nextInstallment` y `paidInstallments` del backend para determinar:
      - Fecha y monto del **siguiente pago pendiente**.
      - Progreso: `Cuota X de N (pagadas: Y)`.
    - Si `nextInstallment` es `null` (todas las cuotas pagadas):
      - Muestra “Próximo pago: (sin cuotas pendientes)”.
      - Deshabilita el botón **Pagar próxima cuota** y cambia su texto a “Préstamo sin cuotas pendientes”.

- **Función de inicio de pago en el navegador**
  - Nueva función global en `my_loans.ejs`:
    ```js
    window.payNextInstallment = async function (id, btn) {
      try {
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Redirigiendo a pago...';
        }
        const res = await fetch(`/api/payments/loans/${id}/installments/next`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data || !data.ok || !data.url || !data.token) {
          const msg = (data && data.error) || ('HTTP ' + res.status);
          alert('No se pudo iniciar el pago: ' + msg);
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'Pagar pr&oacute;xima cuota';
          }
          return;
        }

        const redirectUrl = data.url + '?token_ws=' + encodeURIComponent(data.token);
        window.location.href = redirectUrl;
      } catch (err) {
        console.error(err);
        alert('Error de red al iniciar el pago.');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Pagar pr&oacute;xima cuota';
        }
      }
    };
    ```
  - Esta función se encarga de:
    - Llamar al backend para iniciar el pago de la siguiente cuota.
    - Manejar errores de red o de backend de forma amigable.
    - Redirigir al usuario a la página de pago de Webpay usando el `token_ws` retornado.

- **Vista de resultado de pago**
  - Nueva vista `src/views/payment_result.ejs`:
    - Muestra un mensaje de **pago exitoso** o **no completado** con:
      - Número de préstamo (`loanId`),
      - Número de cuota (`installment`),
      - Monto pagado (`amount`).
    - Incluye un enlace claro para volver a `/my-loans`.
    - Presenta un bloque colapsable con el JSON completo de la respuesta de Transbank para depuración.

---

## Archivos modificados / agregados

- **Backend**
  - `package.json`  
    - Se agrega dependencia: `"transbank-sdk": "^6.1.0"`.
  - `src/routes/payments.js` **(nuevo)**  
    - Router Express de pagos:
      - `POST /api/payments/loans/:id/installments/next`
      - `GET/POST /api/payments/commit`
    - Crea tabla `loan_installment_payments` si no existe.
    - Integra Transbank Webpay Plus (create/commit).
  - `src/routes/loanStatus.js`  
    - Extiende `GET /api/loan-requests/:id/installments` para:
      - Leer pagos desde `loan_installment_payments`.
      - Añadir `paid`, `paidInstallments` y `nextInstallment` al payload.
  - `index.js`  
    - Monta el nuevo router de pagos:
      ```js
      app.use('/api/payments', require('./src/routes/payments'));
      ```

- **Frontend / Vistas**
  - `src/views/my_loans.ejs`  
    - Cards de préstamos activos con:
      - Próximo pago calculado desde backend.
      - Botón “Pagar próxima cuota” que llama a la API nueva.
      - Deshabilitado automático cuando no hay cuotas pendientes.
  - `src/views/payment_result.ejs` **(nuevo)**  
    - Pantalla de confirmación de pago de cuota vía Transbank.

---

## Cómo usar la HU desde la aplicación

1. **Levantar la aplicación** (igual que en HU anteriores)
   - Con Docker (recomendado):
     ```bash
     docker compose up --build
     ```
   - O localmente (requiere PostgreSQL y variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`):
     ```bash
     npm install
     npm run dev
     ```

2. **Crear un préstamo activo** (reutilizando HU001–HU004)
   - Simular y registrar una solicitud desde `/simulator` (HU001).
   - Registrarse / iniciar sesión en `/register` y `/login` (HU004) para obtener un `applicantId` y asociar la solicitud.
   - Aprobar la solicitud cambiando su estado a `APPROVED` (HU002).
   - Firmar el contrato y activar el préstamo (`/requests/:id/contract` → flujo HU003) hasta llegar a estado `ACTIVE`.

3. **Ir a “Mis Préstamos Activos”**
   - Navegar a `/my-loans` (enlace en el header).
   - Verás las tarjetas para cada préstamo activo del solicitante logueado, con:
     - Monto original,
     - Estado,
     - Próximo pago (monto + fecha),
     - Progreso de cuotas.

4. **Pagar la cuota más próxima con Transbank**
   - En la tarjeta del préstamo, hacer clic en **“Pagar próxima cuota”**.
   - El frontend invoca `POST /api/payments/loans/:id/installments/next`.
   - Si todo es correcto, el navegador redirige automáticamente a la página de Webpay (ambiente de integración) usando `token_ws`.
   - Completar el flujo de pago simulado en Transbank.

5. **Volver y ver el resultado del pago**
   - Al finalizar, Transbank redirige al endpoint `/api/payments/commit`.
   - La aplicación:
     - Ejecuta `commit` contra Webpay,
     - Actualiza `loan_installment_payments`,
     - Muestra la pantalla `payment_result.ejs` con el resultado.
   - Desde esa pantalla, se puede regresar a `/my-loans` para ver el estado actualizado de las cuotas (la cuota pagada ya no se ofrecerá como “próxima cuota”).

---

## Notas y consideraciones

- La integración está preparada para **ambiente de integración de Transbank** por defecto, lo que permite probar el flujo con los datos de prueba oficiales.
- Si se configuran valores productivos (`TB_ENV=PROD`, `TB_COMMERCE_CODE`, `TB_API_KEY`), el mismo código puede utilizarse para ambiente productivo (previa configuración y validación con Transbank).
- El diseño del flujo garantiza que **siempre se paga la cuota más próxima pendiente** de un préstamo activo, incluso si el usuario intenta pagar varias veces:
  - La API consulta la tabla de pagos para saber qué cuotas ya están autorizadas/pagadas.
  - El botón en `/my-loans` se desactiva automáticamente cuando no hay cuotas pendientes.

