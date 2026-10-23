"""Run every five minutes: python -m app.jobs.saspay_reconciliation.

Complements signed webhooks when delivery or the initial checkout response was
lost. Performs only provider GET requests; it never starts or retries a payment.
"""
import logging
from app.billing.repositories.saspay_repository import pending_reconciliation, touch_checkout
from app.billing.services.saspay_client import configured
from app.billing.services.saspay_service import verify_checkout

logger=logging.getLogger(__name__)


def run():
    if not configured():
        return
    for checkout_id in pending_reconciliation():
        try:
            verify_checkout(checkout_id)
        except Exception:
            logger.exception('SasPay reconciliation failed for local checkout %s',checkout_id)
        finally:
            touch_checkout(checkout_id)


if __name__=='__main__':
    run()
