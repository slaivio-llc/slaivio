import asyncio
from datetime import date
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.api import clients as api
from app.clients import directory


def test_export_uses_directory_filters_and_escapes_spreadsheet_values(monkeypatch):
    query = MagicMock(return_value={'total':1,'items':[{'display_name':'=FORMULA()', 'phone':'+33612345678'}]})
    monkeypatch.setattr(directory, 'directory', query)
    audit = MagicMock()
    monkeypatch.setattr(api, '_audit_client_bulk_operation', audit)
    result = api.client_directory_export(MagicMock(), q='Jean', customer_type='business',
        start=date(2026,1,1), end=date(2026,2,1), sort='created_desc', tenant={'org_id':'office'})
    query.assert_called_once_with('office','Jean','business',date(2026,1,1),date(2026,2,1),1,'created_desc',page_size=10001)

    async def consume():
        return ''.join([chunk async for chunk in result.body_iterator])

    content = asyncio.run(consume())
    assert "'=FORMULA()" in content
    assert "'+33612345678" in content
    assert 'current_balance' not in content
    audit.assert_called_once()


def test_export_rejects_oversized_results_instead_of_silently_truncating(monkeypatch):
    monkeypatch.setattr(directory, 'directory', MagicMock(return_value={'total':10001,'items':[]}))
    with pytest.raises(HTTPException) as error:
        api.client_directory_export(MagicMock(),q='',tenant={'org_id':'office'})
    assert error.value.status_code == 413
