from fastapi import HTTPException


def reject_client_wallet_mutation():
    """Only trusted server-side settlement may credit or debit platform funds.

    A permission or a client-supplied provider reference is not evidence of
    payment. Keep old URLs as tombstones rather than silently accepting writes.
    """
    raise HTTPException(status_code=410, detail="wallet_client_mutation_retired")
