import { jidNormalizedUser } from "@whiskeysockets/baileys";

export const phoneFromJid = jid => {
  const value = jidNormalizedUser(String(jid || ""));
  if (!value.endsWith("@s.whatsapp.net") && !value.endsWith("@c.us")) return null;
  const digits = value.split("@")[0].split(":")[0].replace(/\D/g, "");
  return digits ? `+${digits}` : null;
};

export const phoneJidFromPhone = value => {
  const raw = String(value || "").trim().replace(/^whatsapp:/i, "");
  const digits = raw.replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : null;
};

export const resolveOutboundJid = (value, lidPhoneMap = new Map()) => {
  const raw = String(value || "").trim().replace(/^whatsapp:/i, "");
  if (!raw) return null;
  if (/@(?:g\.us|lid|s\.whatsapp\.net|c\.us)$/i.test(raw)) {
    return jidNormalizedUser(raw);
  }
  const phoneJid = phoneJidFromPhone(raw);
  if (!phoneJid) return null;
  for (const [lid, mappedPhoneJid] of lidPhoneMap.entries()) {
    if (jidNormalizedUser(String(mappedPhoneJid)) === phoneJid) return jidNormalizedUser(String(lid));
  }
  return phoneJid;
};

export const resolveSenderIdentity = (key, isGroup, lidPhoneMap = new Map()) => {
  const technicalJid = jidNormalizedUser(String(
    (isGroup ? key.participantLid || key.senderLid || key.participant : key.senderLid || key.remoteJid) || "",
  ));
  const candidates = [
    isGroup ? key.participantPn : key.senderPn,
    key.remoteJidAlt,
    lidPhoneMap.get(technicalJid),
    isGroup ? key.participant : key.remoteJid,
  ].filter(Boolean).map(value => jidNormalizedUser(String(value)));
  const phoneJid = candidates.find(candidate => phoneFromJid(candidate));
  return { senderJid: technicalJid || phoneJid || null, phone: phoneFromJid(phoneJid) };
};
