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

/** Like formatIdr but prefixes "+" for positive values, for change/delta display. */
export function formatSignedIdr(amount: string): string {
    return `${BigInt(amount) > 0n ? '+' : ''}${formatIdr(amount)}`;
}

export function formatPercent(percent: string | null | undefined): string {
    if (percent === null || percent === undefined || percent === '') {
        return '—';
    }

    return `${percent.replace('.', ',')}%`;
}

/**
 * Pixel-scale ratio (0..1) of two non-negative money strings, via BigInt so
 * large values do not lose precision. Visual only; never a financial result.
 */
export function ratio(value: string, max: string): number {
    const denominator = BigInt(max);

    if (denominator <= 0n) {
        return 0;
    }

    const scaled = (BigInt(value) * 10000n) / denominator;

    return Math.min(1, Math.max(0, Number(scaled) / 10000));
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
