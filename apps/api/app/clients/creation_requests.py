"""Transaction-scoped protection against replayed client creation requests."""
import hashlib
import json

from sqlalchemy import text
from app.clients.schema_checks import require_table


def request_fingerprint(payload: dict) -> str:
    values = {key: value for key, value in payload.items() if key != 'idempotency_key'}
    encoded = json.dumps(values, sort_keys=True, separators=(',', ':'), default=str)
    return hashlib.sha256(encoded.encode('utf-8')).hexdigest()


def replay_request(conn, org_id: str, actor_id: str, key: str, fingerprint: str):
    require_table(conn, 'client_creation_requests')
    # Serialize equal keys until the surrounding client transaction commits.
    conn.execute(text('select pg_advisory_xact_lock(hashtextextended(:scope, 0))'),
                 {'scope': f'client-create:{org_id}:{actor_id}:{key}'})
    record = conn.execute(text('''
        select payload_hash, client_id::text from client_creation_requests
        where org_id=:org_id and actor_id=:actor_id and request_key=cast(:key as uuid)
    '''), {'org_id': org_id, 'actor_id': actor_id, 'key': key}).mappings().first()
    if record is None:
        return None
    if record['payload_hash'] != fingerprint:
        raise ValueError('client_creation_key_conflict')
    return record['client_id']


def remember_request(conn, org_id: str, actor_id: str, key: str, fingerprint: str, client_id: str):
    conn.execute(text('''
        insert into client_creation_requests(org_id,actor_id,request_key,payload_hash,client_id)
        values (:org_id,:actor_id,cast(:key as uuid),:fingerprint,cast(:client_id as uuid))
    '''), {'org_id': org_id, 'actor_id': actor_id, 'key': key,
           'fingerprint': fingerprint, 'client_id': client_id})
