import assert from "node:assert/strict";
import { phoneFromJid, resolveOutboundJid, resolveSenderIdentity } from "../src/message-identity.js";

assert.equal(phoneFromJid("243900000001@s.whatsapp.net"), "+243900000001");
assert.equal(phoneFromJid("123456789012345@lid"), null);
assert.equal(phoneFromJid("120363123456789012@newsletter"), null);

const groupSender = resolveSenderIdentity({
  participant: "123456789012345@lid",
  participantLid: "123456789012345@lid",
  participantPn: "243900000001@s.whatsapp.net",
}, true);
assert.equal(groupSender.phone, "+243900000001");
assert.equal(groupSender.senderJid, "123456789012345@lid");

const mappedSender = resolveSenderIdentity({
  participant: "123456789012345@lid",
}, true, new Map([["123456789012345@lid", "243900000002@s.whatsapp.net"]]));
assert.equal(mappedSender.phone, "+243900000002");

const privateAltSender = resolveSenderIdentity({
  remoteJid: "123456789012345@lid",
  remoteJidAlt: "243900000003@s.whatsapp.net",
}, false);
assert.equal(privateAltSender.phone, "+243900000003");
assert.equal(privateAltSender.senderJid, "123456789012345@lid");

const identityMap = new Map([["123456789012345@lid", "243900000003@s.whatsapp.net"]]);
assert.equal(resolveOutboundJid("+243 900 000 003", identityMap), "123456789012345@lid");
assert.equal(resolveOutboundJid("123456789012345@lid", identityMap), "123456789012345@lid");
assert.equal(resolveOutboundJid("+243 900 000 004", identityMap), "243900000004@s.whatsapp.net");
assert.equal(resolveOutboundJid("120363123456789012@g.us", identityMap), "120363123456789012@g.us");

console.log("message identity tests passed");
