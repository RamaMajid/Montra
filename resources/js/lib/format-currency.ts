export function formatIdr(amount: string): string {
    const value = BigInt(amount);
    return `${value < 0n ? '-' : ''}Rp${(value < 0n ? -value : value).toLocaleString('id-ID')}`;
}
