const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
});

const monthFormatter = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
});

export function formatIdr(amount: string): string {
    const value = BigInt(amount);
    return `${value < 0n ? '-' : ''}Rp${(value < 0n ? -value : value).toLocaleString('id-ID')}`;
}

export function formatPercent(percent: string | null | undefined): string {
    if (percent === null || percent === undefined || percent === '') {
        return '—';
    }

    return `${percent.replace('.', ',')}%`;
}

export function formatDateId(date: string): string {
    const [year, month, day] = date.split('-').map(Number);

    if (!year || !month || !day) {
        return date;
    }

    return dateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatMonthId(month: string): string {
    const [year, monthNumber] = month.split('-').map(Number);

    if (!year || !monthNumber) {
        return month;
    }

    return monthFormatter.format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}
