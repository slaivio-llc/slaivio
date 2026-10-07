"""Calendar periods: inclusive local dates, exclusive UTC query boundaries."""
from calendar import monthrange
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def _month(day: date, offset: int) -> date:
    year, month = divmod(day.year * 12 + day.month - 1 + offset, 12)
    return date(year, month + 1, 1)


def resolve_period(preset='30d', comparison='previous', timezone_name='UTC',
                   start=None, end=None, compare_start=None, compare_end=None, now=None):
    try:
        zone = ZoneInfo(timezone_name)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError('invalid_timezone') from None
    today = (now or datetime.now(timezone.utc)).astimezone(zone).date()
    month = today.replace(day=1)
    week = today - timedelta(days=today.weekday())
    quarter = today.replace(month=((today.month-1)//3)*3+1, day=1)
    ranges = {
        'today': (today, today), 'yesterday': (today-timedelta(days=1), today-timedelta(days=1)),
        '7d': (today-timedelta(days=6), today), '30d': (today-timedelta(days=29), today),
        '90d': (today-timedelta(days=89), today), 'week': (week, today),
        'last_week': (week-timedelta(days=7), week-timedelta(days=1)),
        'month': (month, today), 'last_month': (_month(month, -1), month-timedelta(days=1)),
        'quarter': (quarter, today), 'last_quarter': (_month(quarter, -3), quarter-timedelta(days=1)),
        'year': (today.replace(month=1, day=1), today),
        'last_year': (date(today.year-1, 1, 1), date(today.year-1, 12, 31)),
    }

    def validate(a, b):
        if not isinstance(a, date) or not isinstance(b, date) or b < a or (b-a).days > 731 or b > today:
            raise ValueError('invalid_date_range')
        return a, b

    if preset == 'custom':
        first, last = validate(start, end)
    elif preset in ranges:
        first, last = ranges[preset]
    else:
        raise ValueError('invalid_period')
    previous = None
    if comparison == 'previous':
        previous = (first-timedelta(days=(last-first).days+1), first-timedelta(days=1))
    elif comparison == 'year':
        def last_year(day):
            return day.replace(year=day.year-1, day=min(day.day, monthrange(day.year-1, day.month)[1]))
        previous = (last_year(first), last_year(last))
    elif comparison == 'custom':
        previous = validate(compare_start, compare_end)
    elif comparison != 'none':
        raise ValueError('invalid_comparison')

    def interval(a, b):
        return {'start': a.isoformat(), 'end': b.isoformat(),
                'start_utc': datetime.combine(a, time.min, zone).astimezone(timezone.utc),
                'end_utc': datetime.combine(b+timedelta(days=1), time.min, zone).astimezone(timezone.utc)}
    return {'timezone': timezone_name, 'preset': preset, 'comparison': comparison,
            'current': interval(first, last), 'previous': interval(*previous) if previous else None}
