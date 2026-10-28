"""Run only against the disposable PostgreSQL URL, never production."""
import os
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, text

from app.platform_admin import demo_requests as repo

URL = os.getenv('TEST_POSTGRES_URL')
pytestmark = pytest.mark.skipif(not URL, reason='Dedicated TEST_POSTGRES_URL is not configured')


@pytest.fixture
def database(monkeypatch):
    assert URL is not None
    schema = 'slaivio_demo_test_' + uuid4().hex
    admin = create_engine(URL)
    with admin.begin() as conn:
        conn.exec_driver_sql(f'create schema {schema}')
    engine = create_engine(URL)

    @event.listens_for(engine, 'connect')
    def search_path(connection, _):
        with connection.cursor() as cursor:
            cursor.execute(f'set search_path to {schema},public')

    try:
        with engine.begin() as conn:
            conn.exec_driver_sql('''create table landing_demo_requests(
              id uuid primary key,full_name text,email text,agency_name text,phone text,country text,
              monthly_shipments text,message text,status text default 'NEW',source text default 'landing',
              created_at timestamptz default now(),updated_at timestamptz default now());
              create table platform_admin_audit_log(id uuid primary key default gen_random_uuid(),
              actor_user_id text,action text,target_type text,target_id text,old_data jsonb,new_data jsonb,
              reason text,created_at timestamptz default now());''')
            migration = (Path(__file__).resolve().parents[3] / 'infra/sql/159_platform_demo_requests_privacy.sql').read_text(encoding='utf-8')
            conn.exec_driver_sql(migration.replace('begin;', '', 1).removesuffix('commit;\n'))
            request_id = uuid4()
            stamp = conn.execute(text('''insert into landing_demo_requests(id,full_name,email,agency_name,country)
              values(:id,'Awa','awa@example.test','Cargo','Bénin') returning updated_at'''), {'id': request_id}).scalar_one()
        monkeypatch.setattr(repo, 'engine', engine)
        yield engine, request_id, stamp
    finally:
        engine.dispose()
        with admin.begin() as conn:
            conn.exec_driver_sql(f'drop schema {schema} cascade')
        admin.dispose()


def test_real_demo_update_preserves_microseconds_and_rejects_stale_write(database):
    _, request_id, stamp = database
    row = repo.update(request_id, 'staff', 'CONTACTED', stamp, 'Premier échange')
    assert isinstance(row, dict)
    assert row['updated_at'] != stamp
    assert repo.update(request_id, 'other-staff', 'CLOSED', stamp, 'stale') == 'conflict'
    result = repo.detail(request_id)
    assert result is not None
    assert result['request']['status'] == 'CONTACTED'
    assert len(result['history']) == 1
    assert result['history'][0]['reason'] == 'Premier échange'
    assert repo.listing(q='awa', status='CONTACTED')['total'] == 1


def test_real_audit_failure_rolls_back_the_demo_update(database, monkeypatch):
    _, request_id, stamp = database

    def fail(*_):
        raise RuntimeError('audit unavailable')

    monkeypatch.setattr(repo, '_audit', fail)
    with pytest.raises(RuntimeError, match='audit unavailable'):
        repo.update(request_id, 'staff', 'CLOSED', stamp, 'note')
    result = repo.detail(request_id)
    assert result is not None
    assert result['request']['status'] == 'NEW'
    assert result['request']['updated_at'] == stamp
    assert result['history'] == []
