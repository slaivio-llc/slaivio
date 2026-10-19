-- Persist editable WhatsApp welcome, away, and fallback response templates.
begin;

alter table ai_settings
  add column if not exists welcome_message_enabled boolean not null default true,
  add column if not exists welcome_message text not null default 'Bonjour 👋 Bienvenue chez notre agence cargo ! Comment pouvons-nous vous aider aujourd’hui ?',
  add column if not exists away_message_enabled boolean not null default false,
  add column if not exists away_message text not null default '',
  add column if not exists fallback_reply_enabled boolean not null default true,
  add column if not exists fallback_reply text not null default 'Je n’ai pas suffisamment d’informations pour répondre avec précision. Je transmets votre demande à notre équipe.';

commit;
