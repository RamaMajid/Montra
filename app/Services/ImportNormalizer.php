<?php

namespace App\Services;

use DateTimeImmutable;

class ImportNormalizer
{
    /** @param array<int, string> $row
     * @param  array<string, mixed>  $mapping
     * @return array<string, mixed>
     */
    public function normalize(array $row, array $mapping): array
    {
        $get = fn (string $field) => isset($mapping[$field]) ? trim($row[(int) $mapping[$field]] ?? '') : null;
        $date = (string) $get('date');
        $format = $mapping['date_format'];
        $parsed = DateTimeImmutable::createFromFormat('!'.$format, $date);
        $validDate = $parsed && $parsed->format($format) === $date;
        $amount = (string) $get('amount');
        $mode = $mapping['amount_format'];
        $pattern = match ($mode) {
            'idr_dot' => '/^(?:[1-9][0-9]{0,2}(?:\.[0-9]{3})+|[1-9][0-9]*)(?:,00)?$/D',
            'idr_comma' => '/^(?:[1-9][0-9]{0,2}(?:,[0-9]{3})+|[1-9][0-9]*)(?:\.00)?$/D',
            default => '/^[1-9][0-9]*$/D',
        };
        if (preg_match($pattern, $amount)) {
            $amount = match ($mode) {
                'idr_dot' => str_replace('.', '', preg_replace('/,00$/', '', $amount)),
                'idr_comma' => str_replace(',', '', preg_replace('/\.00$/', '', $amount)),
                default => $amount,
            };
        } else {
            $amount = 'INVALID_AMOUNT';
        }
        if ($amount !== 'INVALID_AMOUNT' && filter_var($amount, FILTER_VALIDATE_INT) === false) {
            $amount = 'INVALID_AMOUNT';
        }

        return [
            'type' => mb_strtolower((string) $get('type')),
            'description' => $get('description'),
            'amount' => $amount,
            'transaction_date' => $validDate ? $parsed->format('Y-m-d') : null,
            'account_id' => $mapping['account_id'] ?? null,
            'category_id' => $mapping['category_id'] ?? null,
            'source_account_id' => $mapping['source_account_id'] ?? null,
            'destination_account_id' => $mapping['destination_account_id'] ?? null,
            'notes' => $get('notes'),
        ];
    }
}
