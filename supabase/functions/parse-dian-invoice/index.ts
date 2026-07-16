/**
 * ZenMoney — Supabase Edge Function: parse-dian-invoice
 *
 * Recibe el webhook "email.received" de Resend Inbound cuando llega una
 * factura electrónica DIAN reenviada a {family.inboundToken}@<dominio-de-ingesta>,
 * descarga el adjunto .zip, extrae el XML UBL 2.1 (embebido como CDATA dentro
 * del AttachedDocument firmado), parsea los campos clave de forma determinista
 * y crea una transacción `pending` lista para que el usuario la confirme.
 *
 * Secrets requeridos (supabase secrets set ...):
 *   RESEND_API_KEY          — para descargar adjuntos vía la API de Resend
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

    const { email_id, to, subject } = event.data;

    // 1. Validar el patrón de asunto estandarizado por la DIAN:
    //    {NIT}; {Nombre emisor}; {NumFactura}; {TipoDoc}; {Receptor};
    // Se despoja cualquier prefijo de reenvío/respuesta (Fwd:, FW:, RV:, RE:, etc.),
    // ya que un reenvío manual sí los agrega — el filtro automático de Gmail no.
    const cleanSubject = (subject || "").replace(/^(\s*(fwd?|rv|re)\s*:\s*)+/gi, "");
    const subjectMatch = /^\s*(\d{6,12})\s*;\s*([^;]+);\s*([^;]+);\s*(\d{2});/.exec(cleanSubject);
    if (!subjectMatch) {
      return new Response(JSON.stringify({ skipped: "asunto no coincide con el patrón DIAN" }), { status: 200 });
    }
    const [, supplierNitFromSubject, supplierNameFromSubject, invoiceNumber] = subjectMatch;

    // 2. Resolver a qué familia pertenece, según el token en la dirección de destino
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

    // 3. Evitar duplicados: misma factura (NIT + número) ya ingerida para esta familia
    const rawInputTag = `${supplierNitFromSubject};${invoiceNumber}`;
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

    // 4. Descargar el adjunto .zip vía la API de Resend (el webhook solo trae metadata)
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const attachmentsRes = await fetch(`https://api.resend.com/emails/receiving/${email_id}/attachments`, {
      headers: { Authorization: `Bearer ${resendApiKey}` },
    });
    if (!attachmentsRes.ok) {
      return new Response(JSON.stringify({ error: "No se pudieron obtener los adjuntos del correo." }), { status: 502 });
    }
    const attachmentsJson = await attachmentsRes.json();
    const zipAttachment = (attachmentsJson.data || []).find(
      (a: any) => a.content_type === "application/zip" || a.filename?.toLowerCase().endsWith(".zip")
    );
    if (!zipAttachment) {
      return new Response(JSON.stringify({ skipped: "no se encontró adjunto .zip en el correo" }), { status: 200 });
    }

    const zipRes = await fetch(zipAttachment.download_url);
    const zipBuffer = await zipRes.arrayBuffer();
    const zip = await JSZip.loadAsync(zipBuffer);
    const xmlEntry = Object.values(zip.files).find(
      (f: any) => !f.dir && f.name.toLowerCase().endsWith(".xml")
    );
    if (!xmlEntry) {
      return new Response(JSON.stringify({ error: "El .zip no contiene un archivo XML." }), { status: 422 });
    }
    const outerXml = await (xmlEntry as any).async("string");

    // 5. El UBL Invoice real viene embebido como CDATA dentro del AttachedDocument firmado
    const cdataMatch = /<cac:ExternalReference>[\s\S]*?<cbc:Description>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/cbc:Description>/.exec(outerXml);
    const invoiceXml = cdataMatch ? cdataMatch[1] : outerXml;

    // 6. Parseo determinista de los campos clave (esquema fijo DIAN UBL 2.1 — sin IA)
    const amountMatch = /<cbc:PayableAmount[^>]*>([\d.]+)<\/cbc:PayableAmount>/.exec(invoiceXml);
    const issueDateMatch = /<cbc:IssueDate>([\d-]+)<\/cbc:IssueDate>/.exec(invoiceXml);
    const dueDateMatch = /<cbc:PaymentDueDate>([\d-]+)<\/cbc:PaymentDueDate>/.exec(invoiceXml);

    const supplierBlockMatch = /<cac:AccountingSupplierParty>[\s\S]*?<\/cac:AccountingSupplierParty>/.exec(invoiceXml);
    const supplierBlock = supplierBlockMatch ? supplierBlockMatch[0] : "";
    // Prefiere el nombre del punto de venta (PhysicalLocation) sobre la razón social legal.
    // Importante: exige que <cbc:Name> sea el hijo INMEDIATO de PhysicalLocation/PartyName
    // (solo espacios en blanco entre medio) — si no, un match "de largo alcance" sin límite
    // (p.ej. [\s\S]*?) puede saltarse hasta un <cbc:Name> de otro elemento completamente
    // distinto más abajo en el mismo bloque, como el nombre de un TaxScheme ("IVA") cuando
    // el proveedor no incluye un nombre de punto de venta dentro de PhysicalLocation.
    const storeNameMatch = /<cac:PhysicalLocation>\s*<cbc:Name>([^<]+)<\/cbc:Name>/.exec(supplierBlock);
    const legalNameMatch = /<cac:PartyName>\s*<cbc:Name>([^<]+)<\/cbc:Name>/.exec(supplierBlock);
    const nitMatch = /<cac:PartyTaxScheme>[\s\S]*?<cbc:CompanyID[^>]*>(\d+)<\/cbc:CompanyID>/.exec(supplierBlock);

    // Descripción de los ítems comprados (cac:Item > cbc:Description de cada InvoiceLine).
    // Con un solo ítem (ej. una recarga de gasolina) se usa tal cual — mucho más informativo
    // que repetir el nombre del comercio. Con varios (ej. un mercado) se resume el conteo.
    const itemDescriptions = [...invoiceXml.matchAll(/<cac:Item>\s*<cbc:Description>([^<]+)<\/cbc:Description>/g)]
      .map((m) => m[1].trim());

    const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
    const issueDate = issueDateMatch ? issueDateMatch[1] : new Date().toISOString().split("T")[0];
    const dueDate = dueDateMatch ? dueDateMatch[1] : issueDate;
    const merchantName = (storeNameMatch?.[1] || legalNameMatch?.[1] || supplierNameFromSubject).trim();
    const supplierNit = nitMatch ? nitMatch[1] : supplierNitFromSubject;
    const description = itemDescriptions.length === 1
      ? itemDescriptions[0]
      : itemDescriptions.length > 1
        ? `${merchantName} (${itemDescriptions.length} productos)`
        : merchantName;

    if (!amount) {
      return new Response(JSON.stringify({ error: "No se pudo extraer el monto de la factura." }), { status: 422 });
    }

    // 7. Categorización automática por NIT/comercio, reutilizando las mismas reglas
    //    que la app aprende de las correcciones del usuario (auto_categorization_rules)
    const { data: rules } = await supabase
      .from("auto_categorization_rules")
      .select("match_pattern, category_id, priority")
      .eq("family_group_id", familyGroupId)
      .order("priority", { ascending: false });

    const matchedRule = (rules || []).find((r: any) => {
      const pattern = r.match_pattern.toLowerCase();
      return (
        supplierNit.toLowerCase().includes(pattern) ||
        pattern.includes(supplierNit.toLowerCase()) ||
        merchantName.toLowerCase().includes(pattern)
      );
    });
    const categoryId = matchedRule?.category_id || null;

    // 8. Cuenta y usuario por defecto — la transacción queda 'pending' para que
    //    el usuario elija la cuenta real y confirme, igual que con las Facturas manuales
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

    const { data: newTx, error: insertError } = await supabase
      .from("transactions")
      .insert({
        family_group_id: familyGroupId,
        account_id: defaultAccount.id,
        category_id: categoryId,
        created_by_user_id: adminProfile.id,
        type: "expense",
        amount,
        currency: "COP",
        description,
        merchant_name: merchantName,
        transaction_date: issueDate,
        transfer_to_account_id: null,
        is_recurring_instance: false,
        recurring_rule_id: null,
        status: "pending",
        input_method: "email",
        ai_metadata: {
          raw_input: rawInputTag,
          parsed_amount: amount,
          parsed_category: null,
          parsed_account: null,
          parsed_merchant: merchantName,
          confidence: 1,
          corrections: {},
          due_date: dueDate,
        },
      })
      .select("id")
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: `Error al crear la transacción: ${insertError.message}` }), { status: 500 });
    }

    return new Response(
      JSON.stringify({ ok: true, transactionId: newTx.id, merchantName, amount, dueDate }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error interno del servidor." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
