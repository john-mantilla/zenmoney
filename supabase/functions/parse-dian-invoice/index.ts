/**
 * ZenMoney — Supabase Edge Function: parse-dian-invoice
 *
 * Recibe el webhook "email.received" de Resend Inbound cuando llega un correo
 * reenviado a {family.inboundToken}@<dominio-de-ingesta>.
 *
 * Soporta dos modos de procesamiento inteligente:
 * 1. FACTURA ELECTRÓNICA DIAN (Asunto patrón DIAN + Adjunto .ZIP con XML UBL 2.1)
 * 2. NOTIFICACIÓN BANCARIA EN TEXTO/HTML (Bancolombia, Davivienda, Nequi, Nu, PSE, Lulo)
 *    - Clasifica determinísticamente si es Gasto ('expense') o Ingreso ('income').
 *    - Descarta automáticamente extractos, boletines de seguridad o correos no transaccionales.
 *
 * Secrets requeridos (supabase secrets set ...):
 *   RESEND_API_KEY          — para descargar adjuntos/cuerpo vía la API de Resend
 *   RESEND_WEBHOOK_SECRET    — para verificar la firma Svix del webhook
 * (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya están disponibles por defecto)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

// ─── Verificación de firma del webhook (esquema Svix, usado por Resend) ───
async function verifyResendSignature(payload: string, headers: Headers, secret: string): Promise<boolean> {
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const secretBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  return svixSignature.split(" ").some((entry) => entry.split(",")[1] === expectedSignature);
}

// ─── Helper de Parseo de Notificaciones Bancarias (Texto / HTML) ───
function parseBankNotification(subject: string, bodyText: string, currentDate: string) {
  const fullText = `${subject} ${bodyText}`.toLowerCase();

  // 1. Filtrar correos NO transaccionales (Extractos, Seguridad, Promociones)
  const ignoreKeywords = [
    'extracto',
    'resumen mensual',
    'cambio de clave',
    'seguridad',
    'bienvenido',
    'nueva función',
    'promoción',
    'oferta',
    'portafolio',
    'crédito preaprobado',
  ];

  const isIgnored = ignoreKeywords.some((kw) => fullText.includes(kw));
  if (isIgnored && !fullText.includes('compra por') && !fullText.includes('recibiste')) {
    return null;
  }

  // 2. Extraer Banco o Entidad Financiera
  let bankName = 'Notificación Bancaria';
  if (fullText.includes('bancolombia')) bankName = 'Bancolombia';
  else if (fullText.includes('nequi')) bankName = 'Nequi';
  else if (fullText.includes('davivienda') || fullText.includes('daviplata')) bankName = 'Davivienda';
  else if (fullText.includes('nubank') || fullText.includes(' nu ')) bankName = 'Nu';
  else if (fullText.includes('lulo')) bankName = 'Lulo Bank';
  else if (fullText.includes('pse')) bankName = 'PSE';

  // 3. Determinar Tipo de Transacción (Gasto vs Ingreso)
  const expenseKeywords = [
    'compra por',
    'pago por',
    'pago aprobado',
    'transacción aprobada',
    'debito',
    'débito',
    'retiro',
    'transferencia enviada',
    'descontado de tu cuenta',
    'pago pse',
  ];

  const incomeKeywords = [
    'recibiste una consignación',
    'recibiste un pago',
    'te enviaron plata',
    'transferencia recibida',
    'consignación exitosa',
    'abono a tu cuenta',
    'reembolso',
    'recibiste $',
  ];

  let type: 'expense' | 'income' | null = null;
  if (expenseKeywords.some((kw) => fullText.includes(kw))) {
    type = 'expense';
  } else if (incomeKeywords.some((kw) => fullText.includes(kw))) {
    type = 'income';
  }

  if (!type) return null;

  // 4. Extraer Monto ($ 45.000 / $45,000 / $1.500.000)
  const amountRegex = /\$\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/g;
  const matches = [...fullText.matchAll(amountRegex)];
  let amount: number | null = null;

  if (matches.length > 0) {
    for (const m of matches) {
      const rawNumStr = m[1].replace(/\./g, '').replace(/,/g, '');
      const parsedNum = parseFloat(rawNumStr);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        amount = parsedNum;
        break;
      }
    }
  }

  if (!amount) return null;

  // 5. Extraer Comercio / Establecimiento / Remitente
  let merchantName = bankName;
  const merchantRegex = /(?:en|para|de)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s._-]+?)(?:\s+el|\s+por|\s+con|\s+fecha|\s+\d{2}\/|\.|$)/i;
  const match = merchantRegex.exec(`${subject} ${bodyText}`);
  if (match && match[1]) {
    const cleaned = match[1].trim();
    if (cleaned.length > 2 && cleaned.length < 40 && !cleaned.includes('$')) {
      merchantName = cleaned;
    }
  }

  const description = type === 'income'
    ? `Ingreso por correo (${merchantName})`
    : `Gasto por correo (${merchantName})`;

  return {
    type,
    amount,
    merchantName,
    description,
    transactionDate: currentDate,
    bankName,
  };
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const rawBody = await req.text();

    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (webhookSecret) {
      const isValid = await verifyResendSignature(rawBody, req.headers, webhookSecret);
      if (!isValid) {
        return new Response(JSON.stringify({ error: "Firma de webhook inválida." }), { status: 401 });
      }
    }

    const event = JSON.parse(rawBody);
    if (event.type !== "email.received") {
      return new Response(JSON.stringify({ skipped: "evento no relevante" }), { status: 200 });
    }

    const { email_id, to, subject, text, html } = event.data;

    // Resolver a qué familia pertenece según el token en la dirección de destino
    const recipient = Array.isArray(to) ? to[0] : to;
    const token = (recipient || "").split("@")[0];
    if (!token) {
      return new Response(JSON.stringify({ error: "No se pudo determinar el destinatario." }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: familyGroup } = await supabase
      .from("family_groups")
      .select("id")
      .eq("inbound_token", token)
      .maybeSingle();

    if (!familyGroup) {
      return new Response(JSON.stringify({ skipped: "token de reenvío desconocido" }), { status: 200 });
    }
    const familyGroupId = familyGroup.id;

    // Obtener la cuenta y el usuario administrador por defecto
    const { data: defaultAccount } = await supabase
      .from("accounts")
      .select("id")
      .eq("family_group_id", familyGroupId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: adminProfile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("family_group_id", familyGroupId)
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    if (!defaultAccount || !adminProfile) {
      return new Response(
        JSON.stringify({ error: "La familia no tiene cuenta activa o administrador configurado." }),
        { status: 422 }
      );
    }

    const todayStr = new Date().toISOString().split("T")[0];

    // ─── MODO 1: PROCESAR COMO FACTURA ELECTRÓNICA DIAN (CON ADJUNTO ZIP) ───
    const cleanSubject = (subject || "").replace(/^(\s*(fwd?|rv|re)\s*:\s*)+/gi, "");
    const subjectMatch = /^\s*(\d{6,12})\s*;\s*([^;]+);\s*([^;]+);\s*(\d{2});/.exec(cleanSubject);

    if (subjectMatch) {
      const [, supplierNitFromSubject, supplierNameFromSubject, invoiceNumber] = subjectMatch;
      const rawInputTag = `${supplierNitFromSubject};${invoiceNumber}`;

      // Evitar duplicados
      const { data: existing } = await supabase
        .from("transactions")
        .select("id")
        .eq("family_group_id", familyGroupId)
        .contains("ai_metadata", { raw_input: rawInputTag })
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ skipped: "factura ya registrada", transactionId: existing.id }),
          { status: 200 }
        );
      }

      // Descargar el adjunto .zip vía la API de Resend
      const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
      const attachmentsRes = await fetch(`https://api.resend.com/emails/receiving/${email_id}/attachments`, {
        headers: { Authorization: `Bearer ${resendApiKey}` },
      });

      if (attachmentsRes.ok) {
        const attachmentsJson = await attachmentsRes.json();
        const zipAttachment = (attachmentsJson.data || []).find(
          (a: any) => a.content_type === "application/zip" || a.filename?.toLowerCase().endsWith(".zip")
        );

        if (zipAttachment) {
          const zipRes = await fetch(zipAttachment.download_url);
          const zipBuffer = await zipRes.arrayBuffer();
          const zip = await JSZip.loadAsync(zipBuffer);
          const xmlEntry = Object.values(zip.files).find(
            (f: any) => !f.dir && f.name.toLowerCase().endsWith(".xml")
          );

          if (xmlEntry) {
            const outerXml = await (xmlEntry as any).async("string");
            const cdataMatch = /<cac:ExternalReference>[\s\S]*?<cbc:Description>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/cbc:Description>/.exec(outerXml);
            const invoiceXml = cdataMatch ? cdataMatch[1] : outerXml;

            const amountMatch = /<cbc:PayableAmount[^>]*>([\d.]+)<\/cbc:PayableAmount>/.exec(invoiceXml);
            const issueDateMatch = /<cbc:IssueDate>([\d-]+)<\/cbc:IssueDate>/.exec(invoiceXml);
            const supplierBlockMatch = /<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/.exec(invoiceXml);
            const supplierBlock = supplierBlockMatch ? supplierBlockMatch[0] : "";
            const storeNameMatch = /<cac:PhysicalLocation>\s*<cbc:Name>([^<]+)<\/cbc:Name>/.exec(supplierBlock);
            const legalNameMatch = /<cac:PartyName>\s*<cbc:Name>([^<]+)<\/cbc:Name>/.exec(supplierBlock);

            const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
            const issueDate = issueDateMatch ? issueDateMatch[1] : todayStr;
            const merchantName = (storeNameMatch?.[1] || legalNameMatch?.[1] || supplierNameFromSubject).trim();

            if (amount) {
              const { data: newTx } = await supabase
                .from("transactions")
                .insert({
                  family_group_id: familyGroupId,
                  account_id: defaultAccount.id,
                  category_id: null,
                  created_by_user_id: adminProfile.id,
                  type: "expense",
                  amount,
                  currency: "COP",
                  description: `Factura Electrónica (${merchantName})`,
                  merchant_name: merchantName,
                  transaction_date: issueDate,
                  status: "pending",
                  input_method: "email",
                  ai_metadata: { raw_input: rawInputTag, parsed_amount: amount, is_dian_invoice: true },
                })
                .select("id")
                .single();

              return new Response(
                JSON.stringify({ ok: true, transactionId: newTx?.id, mode: "dian_invoice" }),
                { status: 200 }
              );
            }
          }
        }
      }
    }

    // ─── MODO 2: PROCESAR COMO NOTIFICACIÓN BANCARIA EN TEXTO / HTML ───
    const bodyContent = text || html || subject || "";
    const bankResult = parseBankNotification(subject || "", bodyContent, todayStr);

    if (!bankResult) {
      return new Response(
        JSON.stringify({ skipped: "correo no transaccional o sin monto legible" }),
        { status: 200 }
      );
    }

    // Evitar duplicados por id de correo o mismo asunto/monto en el día
    const rawInputTag = `bank_mail_${email_id}_${bankResult.amount}_${bankResult.type}`;
    const { data: existingBankTx } = await supabase
      .from("transactions")
      .select("id")
      .eq("family_group_id", familyGroupId)
      .contains("ai_metadata", { raw_input: rawInputTag })
      .maybeSingle();

    if (existingBankTx) {
      return new Response(
        JSON.stringify({ skipped: "notificación bancaria ya registrada", transactionId: existingBankTx.id }),
        { status: 200 }
      );
    }

    const { data: newBankTx, error: insertError } = await supabase
      .from("transactions")
      .insert({
        family_group_id: familyGroupId,
        account_id: defaultAccount.id,
        category_id: null,
        created_by_user_id: adminProfile.id,
        type: bankResult.type,
        amount: bankResult.amount,
        currency: "COP",
        description: bankResult.description,
        merchant_name: bankResult.merchantName,
        transaction_date: bankResult.transactionDate,
        status: "pending",
        input_method: "email",
        ai_metadata: {
          raw_input: rawInputTag,
          is_bank_notification: true,
          bank_name: bankResult.bankName,
          parsed_amount: bankResult.amount,
        },
      })
      .select("id")
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        transactionId: newBankTx?.id,
        mode: "bank_text_notification",
        type: bankResult.type,
        amount: bankResult.amount,
        bankName: bankResult.bankName,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error interno del servidor." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
