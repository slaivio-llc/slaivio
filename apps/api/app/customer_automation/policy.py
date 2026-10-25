"""Agency-owned plain-text messages: no expressions, attributes or HTML evaluation."""
from string import Formatter
from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator

VARIABLE_ALIASES={'agence':'agency','client':'client','suivi':'tracking','destination':'destination',
 'conditions':'conditions','motif':'reason','fraisDeGarde':'storage_fee','soldeDeGarde':'storage_balance',
 'devise':'currency','montant':'amount','facture':'document_number','resumePaiement':'payment_summary',
 'recu':'receipt','lienFacture':'document_url','trajet':'route','dateDepart':'departure_date','informationManquante':'missing'}

TEMPLATES = {
 'prospect_followup': 'Bonjour, souhaitez-vous poursuivre votre demande ? Il nous manque {informationManquante}.',
 'awaiting_parcel': 'Bonjour {client}, nous attendons votre colis. Avez-vous déjà organisé son dépôt à notre entrepôt ? Répondez à ce message si vous avez besoin d’aide.',
 'departure_blocked': 'Votre colis {suivi} attend une régularisation avant son départ : {motif}. Contactez notre équipe pour préparer son expédition.',
 'pickup_reminder': 'Votre colis {suivi} est disponible au retrait. {conditions}',
 'storage_due': 'Votre colis {suivi} est toujours disponible. La période de garde gratuite est terminée. Frais de garde facturés : {fraisDeGarde} {devise}. Solde de garde à régler : {soldeDeGarde} {devise}. {conditions}',
 'payment_confirmed': 'Nous confirmons votre paiement de {montant} {devise} pour la facture {facture}. {resumePaiement} Reçu : {recu}.',
 'documents_ready': 'Merci pour votre confiance. Vos colis ont été remis. Retrouvez votre facture numérique ici : {lienFacture}',
 'package_received': 'Votre colis {suivi} est arrivé à notre entrepôt.',
 'departure_confirmed': 'Le départ de votre colis {suivi} vers {destination} est confirmé.',
 'package_arrived': 'Votre colis {suivi} est arrivé à destination ({destination}). {conditions}',
 'ready_for_pickup': 'Votre colis {suivi} est prêt à être retiré. {conditions}',
 'next_departure': 'Prochain départ {trajet} prévu le {dateDepart}. Contactez-nous pour préparer votre envoi.',
}
VARIABLES = {'agency','client','tracking','destination','conditions','reason','storage_fee','storage_balance','missing',
             'currency','amount','document_number','payment_summary','receipt','document_url','route','departure_date'}


def validate_template(value):
 try:
  for _, field, spec, conversion in Formatter().parse(value):
   if field is not None and (field not in VARIABLES|VARIABLE_ALIASES.keys() or spec or conversion):
    raise ValueError('Variable de message non autorisée.')
 except ValueError:
  raise ValueError('Utilisez uniquement les variables de message proposées, entre accolades.') from None
 return value


class CustomerAutomation(BaseModel):
 model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)
 awaiting_enabled: StrictBool=True
 awaiting_delay_days: int=Field(default=3,ge=1,le=365,strict=True)
 reminder_interval_days: int=Field(default=3,ge=1,le=90,strict=True)
 max_reminders: int=Field(default=3,ge=1,le=20,strict=True)
 blocked_enabled: StrictBool=True
 pickup_enabled: StrictBool=True
 pickup_delay_days: int=Field(default=2,ge=1,le=365,strict=True)
 payment_enabled: StrictBool=True
 documents_enabled: StrictBool=True
 announcements_enabled: StrictBool=True
 pickup_conditions: str=Field(default='',max_length=2000)
 messages: dict[str,str]=Field(default_factory=dict,max_length=30)

 @field_validator('messages')
 @classmethod
 def templates(cls, value):
  for key, template in value.items():
   if key not in TEMPLATES or not 1<=len(template)<=3000:
    raise ValueError('Modèle de message non reconnu ou trop long.')
   validate_template(template)
   required={'documents_ready':{'document_url'},'payment_confirmed':{'amount','currency','payment_summary'}}.get(key,set())
   fields={VARIABLE_ALIASES.get(field,field) for _,field,_,_ in Formatter().parse(template) if field}
   if not required<=fields:
    preferred={key:alias for alias,key in VARIABLE_ALIASES.items()}
    raise ValueError('Conservez les variables indispensables : '+', '.join('{'+preferred.get(key,key)+'}' for key in sorted(required)))
  return value


def message(policy, kind, values):
 template=policy.get('messages',{}).get(kind) or TEMPLATES[kind]
 validate_template(template)
 variables={key:str(values.get(key) or '') for key in VARIABLES}
 variables.update({alias:variables[key] for alias,key in VARIABLE_ALIASES.items()})
 body=template.format_map(variables)
 return f"{values.get('agency') or 'Votre agence'}\n\n{body}".strip()
