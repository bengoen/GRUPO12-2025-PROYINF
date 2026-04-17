const nodemailer = require('nodemailer');
const https = require('https');
const querystring = require('querystring');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const BRAND_NAME = 'Tu Préstamo Digital';
const BRAND_TAGLINE = 'Finanzas a tu medida';
const BRAND_BLUE = '#1A56DB';
const BRAND_DARK = '#0D3F9E';

function formatCLP(num) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(Number(num || 0));
}

function formatDate(iso) {
  if (!iso) return '?';
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDateShort(iso) {
  if (!iso) return '?';
  return new Date(iso).toLocaleDateString('es-CL');
}

// ─── EMAIL HTML ───────────────────────────────────────────────────────────────

function infoRow(label, value) {
  return `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #E5E7EB;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="color:#6B7280;font-size:13px;width:50%;">${label}</td>
            <td style="color:#111827;font-size:13px;font-weight:600;text-align:right;">${value}</td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function buildEmailHtml({ name, preheader, alertLabel, alertBg, alertFg, title, intro, infoRows, mainMessage, ctaUrl, ctaLabel, ctaBg, subText }) {
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${BRAND_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#EEF2F7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#EEF2F7;">${preheader}</div>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#EEF2F7;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,${BRAND_BLUE} 0%,${BRAND_DARK} 100%);border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
            <p style="margin:0 0 2px;color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Comunicación Oficial</p>
            <h1 style="margin:0;color:#FFFFFF;font-size:24px;font-weight:700;letter-spacing:-0.3px;">${BRAND_NAME}</h1>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.65);font-size:13px;">${BRAND_TAGLINE}</p>
          </td>
        </tr>

        <!-- ALERT BADGE -->
        <tr>
          <td style="background:${alertBg};padding:11px 40px;text-align:center;">
            <p style="margin:0;color:${alertFg};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${alertLabel}</p>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="background:#FFFFFF;padding:40px;">

            <p style="margin:0 0 4px;color:#6B7280;font-size:13px;font-weight:500;">Estimado/a</p>
            <h2 style="margin:0 0 28px;color:#111827;font-size:26px;font-weight:700;">${name}</h2>

            <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.75;">${intro}</p>

            <!-- INFO BOX -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                   style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;margin-bottom:32px;">
              <tr><td style="padding:20px 24px;">
                <p style="margin:0 0 12px;color:#374151;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Detalle del aviso</p>
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  ${infoRows}
                </table>
              </td></tr>
            </table>

            <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.75;">${mainMessage}</p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 32px;">
              <tr>
                <td style="background:${ctaBg};border-radius:8px;box-shadow:0 4px 12px rgba(26,86,219,0.3);">
                  <a href="${ctaUrl}"
                     style="display:inline-block;padding:15px 40px;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:0.3px;">
                    ${ctaLabel}&nbsp;&nbsp;→
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;color:#6B7280;font-size:13px;line-height:1.65;">${subText}</p>

          </td>
        </tr>

        <!-- DIVIDER -->
        <tr><td style="background:#FFFFFF;padding:0 40px;"><div style="border-top:1px solid #E5E7EB;"></div></td></tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#FFFFFF;border-radius:0 0 12px 12px;padding:24px 40px 32px;text-align:center;">
            <p style="margin:0 0 6px;color:#374151;font-size:13px;font-weight:600;">${BRAND_NAME}</p>
            <p style="margin:0 0 12px;color:#9CA3AF;font-size:12px;">${BRAND_TAGLINE}</p>
            <p style="margin:0;color:#9CA3AF;font-size:11px;line-height:1.7;">
              Este es un mensaje automático de nuestro sistema de cobranza.<br>
              Por favor no responda a este correo electrónico.<br>
              Para consultas, acceda a su cuenta en
              <a href="${APP_URL}" style="color:${BRAND_BLUE};text-decoration:none;">${APP_URL}</a>
            </p>
          </td>
        </tr>

        <!-- SHADOW FOOTER -->
        <tr>
          <td style="background:#EEF2F7;padding:16px 0;text-align:center;">
            <p style="margin:0;color:#9CA3AF;font-size:10px;">© ${new Date().getFullYear()} ${BRAND_NAME} · Todos los derechos reservados</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── PLANTILLAS POR TIPO ──────────────────────────────────────────────────────

function buildSubjectAndBody(template, name, payload) {
  const firstName = name || 'Cliente';
  const num = payload.installment || '?';
  const date = formatDate(payload.dueDate);
  const dateShort = formatDateShort(payload.dueDate);
  const amount = formatCLP(payload.totalPayment);
  const loanId = payload.loanId || payload.loan_request_id || '';
  const payUrl = `${APP_URL}/my-loans`;
  const requestsUrl = `${APP_URL}/requests`;

  switch (template) {

    case 'installment_due_soon': {
      const subject = `⏰ Recordatorio — Su cuota #${num} vence en 3 días`;
      const emailHtml = buildEmailHtml({
        name: firstName,
        preheader: `Su cuota #${num} por ${amount} vence el ${date}. Prepare su pago a tiempo.`,
        alertLabel: '📅 Aviso de Vencimiento Próximo',
        alertBg: '#EFF6FF',
        alertFg: '#1D4ED8',
        title: 'Cuota próxima a vencer',
        intro: `Le informamos que tiene una cuota próxima a su fecha de vencimiento. Le recomendamos gestionar su pago con anticipación para evitar cargos por mora o intereses adicionales.`,
        infoRows: infoRow('N° de cuota', `#${num}`) +
                  infoRow('Monto a pagar', amount) +
                  infoRow('Fecha de vencimiento', date) +
                  infoRow('Préstamo', `#${loanId}`),
        mainMessage: `Recuerde que contamos con múltiples opciones de pago disponibles en nuestra plataforma, incluyendo pago con tarjeta de débito y crédito a través de Webpay Plus.`,
        ctaUrl: payUrl,
        ctaLabel: 'Pagar mi cuota ahora',
        ctaBg: BRAND_BLUE,
        subText: `Si ya realizó el pago, puede ignorar este mensaje. El procesamiento puede demorar hasta 24 horas hábiles en reflejarse en el sistema.`
      });
      const whatsappText = [
        `🏦 *${BRAND_NAME}*`,
        `_${BRAND_TAGLINE}_`,
        `━━━━━━━━━━━━━━━━━`,
        ``,
        `Estimado/a *${firstName}*,`,
        ``,
        `📅 *Recordatorio de cuota próxima a vencer*`,
        ``,
        `Le informamos que su cuota *#${num}* por *${amount}* vence el *${date}*.`,
        ``,
        `Le recomendamos realizar el pago a tiempo para evitar cargos adicionales.`,
        ``,
        `💳 *Opciones de pago disponibles:*`,
        `• Webpay Plus (débito / crédito)`,
        `• Directamente en nuestra plataforma`,
        ``,
        `👉 Acceda al portal de pagos:`,
        payUrl,
        ``,
        `━━━━━━━━━━━━━━━━━`,
        `_Mensaje automático · ${BRAND_NAME}_`
      ].join('\n');
      const smsText = `${BRAND_NAME}: Hola ${firstName}, su cuota #${num} (${amount}) vence el ${dateShort}. Pague en: ${payUrl}`;
      return { subject, emailHtml, whatsappText, smsText };
    }

    case 'installment_due_today': {
      const subject = `⚠️ URGENTE — Su cuota #${num} vence HOY`;
      const emailHtml = buildEmailHtml({
        name: firstName,
        preheader: `Su cuota #${num} por ${amount} vence hoy. Realice su pago para evitar mora.`,
        alertLabel: '⚠️ Aviso Urgente — Vencimiento Hoy',
        alertBg: '#FFFBEB',
        alertFg: '#B45309',
        title: 'Su cuota vence hoy',
        intro: `Le comunicamos que su cuota de préstamo vence el día de hoy. Para evitar el cobro de intereses por mora y el reporte a sistemas de información crediticia, realice su pago antes de las 23:59 hrs.`,
        infoRows: infoRow('N° de cuota', `#${num}`) +
                  infoRow('Monto a pagar', amount) +
                  infoRow('Fecha de vencimiento', `${date} <span style="color:#B45309;font-weight:700;">(HOY)</span>`) +
                  infoRow('Préstamo', `#${loanId}`),
        mainMessage: `Realice su pago de forma inmediata a través de nuestra plataforma. El proceso es rápido, seguro y disponible las 24 horas.`,
        ctaUrl: payUrl,
        ctaLabel: 'Pagar ahora — Vence hoy',
        ctaBg: '#D97706',
        subText: `Ante cualquier dificultad para realizar el pago, le recomendamos comunicarse con nuestro equipo de atención al cliente a la brevedad.`
      });
      const whatsappText = [
        `🏦 *${BRAND_NAME}*`,
        `━━━━━━━━━━━━━━━━━`,
        ``,
        `Estimado/a *${firstName}*,`,
        ``,
        `⚠️ *AVISO URGENTE — Su cuota vence HOY*`,
        ``,
        `Su cuota *#${num}* por *${amount}* vence el día de *HOY*.`,
        ``,
        `Para evitar cargos por mora, realice su pago antes de las *23:59 hrs*.`,
        ``,
        `👉 Pague ahora:`,
        payUrl,
        ``,
        `━━━━━━━━━━━━━━━━━`,
        `_Mensaje automático · ${BRAND_NAME}_`
      ].join('\n');
      const smsText = `${BRAND_NAME}: URGENTE ${firstName}, cuota #${num} (${amount}) vence HOY. Pague ya: ${payUrl}`;
      return { subject, emailHtml, whatsappText, smsText };
    }

    case 'installment_overdue': {
      const days = Math.abs(payload.daysUntilDue || 0);
      const subject = `🔴 Cuota #${num} vencida — Regularice su pago a la brevedad`;
      const emailHtml = buildEmailHtml({
        name: firstName,
        preheader: `Su cuota #${num} venció hace ${days} día(s). Regularice para evitar consecuencias adicionales.`,
        alertLabel: '🔴 Cuota Vencida — Acción Requerida',
        alertBg: '#FEF2F2',
        alertFg: '#B91C1C',
        title: 'Tiene una cuota vencida',
        intro: `Le informamos que registra una cuota de préstamo en mora. Le solicitamos regularizar su situación a la brevedad para evitar el devengo de intereses adicionales y posibles reportes a sistemas de información crediticia.`,
        infoRows: infoRow('N° de cuota', `#${num}`) +
                  infoRow('Monto vencido', `<span style="color:#B91C1C;font-weight:700;">${amount}</span>`) +
                  infoRow('Fecha de vencimiento', date) +
                  infoRow('Días en mora', `<span style="color:#B91C1C;font-weight:700;">${days} día(s)</span>`) +
                  infoRow('Préstamo', `#${loanId}`),
        mainMessage: `El no pago oportuno de sus cuotas puede generar intereses moratorios y afectar su historial crediticio. Le invitamos a regularizar su situación de inmediato a través de nuestra plataforma de pagos, disponible las 24 horas, los 7 días de la semana.`,
        ctaUrl: payUrl,
        ctaLabel: 'Regularizar mi pago ahora',
        ctaBg: '#DC2626',
        subText: `Si tiene dificultades para pagar el monto total, le recomendamos comunicarse con nuestro equipo para evaluar alternativas de pago. Queremos ayudarle a resolver esta situación.`
      });
      const whatsappText = [
        `🏦 *${BRAND_NAME}*`,
        `━━━━━━━━━━━━━━━━━`,
        ``,
        `Estimado/a *${firstName}*,`,
        ``,
        `🔴 *Aviso de Mora — Cuota Vencida*`,
        ``,
        `Registramos que su cuota *#${num}* por *${amount}*, con vencimiento el *${date}*, se encuentra impaga hace *${days} día(s)*.`,
        ``,
        `Le solicitamos regularizar su situación a la brevedad para evitar:`,
        `• Intereses moratorios adicionales`,
        `• Reportes a sistemas de información crediticia`,
        ``,
        `👉 Regularice ahora:`,
        payUrl,
        ``,
        `Si tiene dificultades de pago, por favor contáctenos.`,
        ``,
        `━━━━━━━━━━━━━━━━━`,
        `_Mensaje automático · ${BRAND_NAME}_`
      ].join('\n');
      const smsText = `${BRAND_NAME}: ${firstName}, cuota #${num} (${amount}) vencida hace ${days} dias. Regularice: ${payUrl}`;
      return { subject, emailHtml, whatsappText, smsText };
    }

    case 'status_changed': {
      const statusLabels = {
        APPROVED: 'Aprobado ✅',
        REJECTED: 'Rechazado ❌',
        CONTRACT_PENDING: 'Contrato pendiente de firma 📄',
        CONTRACT_SIGNED: 'Contrato firmado ✍️',
        ACTIVE: 'Préstamo activo 🎉',
        DISBURSED: 'Desembolsado 💳'
      };
      const statusLabel = statusLabels[payload.newStatus] || payload.newStatus || '';
      const subject = `📋 Actualización de su solicitud #${loanId} — ${statusLabel}`;
      const emailHtml = buildEmailHtml({
        name: firstName,
        preheader: `El estado de su solicitud #${loanId} fue actualizado a: ${statusLabel}.`,
        alertLabel: '📋 Actualización de Estado de Solicitud',
        alertBg: '#F0FDF4',
        alertFg: '#166534',
        title: 'Cambio en su solicitud',
        intro: `Le informamos que el estado de su solicitud de préstamo ha sido actualizado. A continuación encontrará el detalle del cambio registrado en nuestros sistemas.`,
        infoRows: infoRow('N° de solicitud', `#${loanId}`) +
                  infoRow('Nuevo estado', `<strong>${statusLabel}</strong>`) +
                  infoRow('Fecha de actualización', formatDate(new Date().toISOString())),
        mainMessage: `Puede revisar el detalle completo de su solicitud, incluyendo el historial de cambios, en el portal de clientes de ${BRAND_NAME}.`,
        ctaUrl: requestsUrl,
        ctaLabel: 'Ver mis solicitudes',
        ctaBg: '#059669',
        subText: `Si no reconoce este cambio o tiene dudas sobre el estado de su solicitud, contáctenos de inmediato a través de nuestra plataforma.`
      });
      const whatsappText = [
        `🏦 *${BRAND_NAME}*`,
        `━━━━━━━━━━━━━━━━━`,
        ``,
        `Estimado/a *${firstName}*,`,
        ``,
        `📋 *Actualización de su solicitud #${loanId}*`,
        ``,
        `Le informamos que el estado de su solicitud ha sido actualizado:`,
        ``,
        `*Nuevo estado:* ${statusLabel}`,
        ``,
        `👉 Revise el detalle en:`,
        requestsUrl,
        ``,
        `━━━━━━━━━━━━━━━━━`,
        `_Mensaje automático · ${BRAND_NAME}_`
      ].join('\n');
      const smsText = `${BRAND_NAME}: Solicitud #${loanId} actualizada a "${payload.newStatus}". Revise en: ${requestsUrl}`;
      return { subject, emailHtml, whatsappText, smsText };
    }

    default: {
      const subject = `Notificación de ${BRAND_NAME}`;
      const emailHtml = buildEmailHtml({
        name: firstName,
        preheader: `Tiene una notificación sobre su cuenta en ${BRAND_NAME}.`,
        alertLabel: 'Notificación de su cuenta',
        alertBg: '#EFF6FF',
        alertFg: '#1D4ED8',
        title: 'Tiene una notificación',
        intro: `Le informamos que existe una novedad en su cuenta de ${BRAND_NAME}.`,
        infoRows: '',
        mainMessage: `Ingrese a la plataforma para revisar el detalle completo de esta notificación.`,
        ctaUrl: payUrl,
        ctaLabel: 'Ir a mi cuenta',
        ctaBg: BRAND_BLUE,
        subText: ''
      });
      const whatsappText = `🏦 *${BRAND_NAME}*\n\nHola ${firstName}, tiene una notificación en su cuenta.\n\n${payUrl}\n\n_Mensaje automático_`;
      const smsText = `${BRAND_NAME}: Hola ${firstName}, tiene una notificacion. Revise: ${payUrl}`;
      return { subject, emailHtml, whatsappText, smsText };
    }
  }
}

// ─── TRANSPORTE EMAIL ─────────────────────────────────────────────────────────

function getMailTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
  });
}

async function sendEmail(toAddress, name, template, payload) {
  const transporter = getMailTransporter();
  if (!transporter || !toAddress) return;
  const { subject, emailHtml } = buildSubjectAndBody(template, name, payload);
  const textFallback = emailHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  await transporter.sendMail({
    from: `"${BRAND_NAME}" <${process.env.GMAIL_USER}>`,
    to: toAddress,
    subject,
    text: textFallback,
    html: emailHtml
  });
}

// ─── TWILIO (WHATSAPP / SMS) ──────────────────────────────────────────────────

function normalizeChileanPhone(raw) {
  if (!raw) return null;
  let phone = String(raw).replace(/[\s\-().]/g, '');
  if (phone.startsWith('+')) return phone;
  if (phone.startsWith('56')) return '+' + phone;
  if (phone.startsWith('9')) return '+56' + phone;
  if (phone.startsWith('0')) return '+56' + phone.slice(1);
  return '+56' + phone;
}

function twilioPost(path, params) {
  return new Promise((resolve, reject) => {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const body = querystring.stringify(params);
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const req = https.request({
      hostname: 'api.twilio.com',
      path,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`Twilio ${res.statusCode}: ${data}`));
        else resolve(JSON.parse(data));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sendWhatsApp(rawPhone, name, template, payload) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) return;
  const phone = normalizeChileanPhone(rawPhone);
  if (!phone) return;
  const { whatsappText } = buildSubjectAndBody(template, name, payload);
  await twilioPost(`/2010-04-01/Accounts/${sid}/Messages.json`, {
    From: `whatsapp:${from}`,
    To: `whatsapp:${phone}`,
    Body: whatsappText
  });
}

async function sendSMS(rawPhone, name, template, payload) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_SMS_FROM;
  if (!sid || !token || !from) return;
  const phone = normalizeChileanPhone(rawPhone);
  if (!phone) return;
  const { smsText } = buildSubjectAndBody(template, name, payload);
  const truncated = smsText.length > 160 ? smsText.slice(0, 157) + '...' : smsText;
  await twilioPost(`/2010-04-01/Accounts/${sid}/Messages.json`, {
    From: from,
    To: phone,
    Body: truncated
  });
}

module.exports = { sendEmail, sendWhatsApp, sendSMS };
