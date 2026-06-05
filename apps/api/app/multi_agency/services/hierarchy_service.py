from app.multi_agency.repositories.hierarchy_repository import (
    create_country,
    create_group,
    list_hierarchy,
)


def setup_group_country(
    group_code: str,
    group_name: str,
    country_code: str,
    country_name: str,
    default_currency_code: str = "USD",
    default_timezone: str = "UTC",
):
    group = create_group(
        group_code=group_code,
        group_name=group_name,
    )

    country = create_country(
        group_id=str(group["id"]),
        country_code=country_code,
        country_name=country_name,
        default_currency_code=default_currency_code,
        default_timezone=default_timezone,
    )

    return {
        "group": group,
        "country": country,
    }


def get_enterprise_hierarchy():
    return list_hierarchy()

