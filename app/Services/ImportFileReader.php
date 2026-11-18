<?php

namespace App\Services;

use DateTimeInterface;
use Generator;
use OpenSpout\Reader\CSV\Reader as CsvReader;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use RuntimeException;

class ImportFileReader
{
    /** @return Generator<int, array<int, string>> */
    public function rows(string $path, string $type): Generator
    {
        $reader = $type === 'xlsx' ? new XlsxReader : new CsvReader;
        try {
            $reader->open($path);
            foreach ($reader->getSheetIterator() as $sheet) {
                foreach ($sheet->getRowIterator() as $number => $row) {
                    if ($number > 100001) {
                        throw new RuntimeException('Maximum 100000 data rows supported.');
                    }
                    $values = array_map(function ($value): string {
                        if ($value instanceof DateTimeInterface) {
                            return $value->format('Y-m-d');
                        }
                        if ($value instanceof \DateInterval) {
                            return $value->format('%R%d days');
                        }
                        if (is_float($value)) {
                            // shortcut: XLSX numbers beyond 15 digits are rejected; use text cells for large IDR values.
                            if (abs($value) >= 1e15) {
                                return 'UNSAFE_NUMERIC_CELL';
                            }

                            return rtrim(rtrim(sprintf('%.10F', $value), '0'), '.');
                        }
                        if (is_bool($value)) {
                            return $value ? 'true' : 'false';
                        }

                        return (string) $value;
                    }, $row->toArray());
                    if (strlen(json_encode($values, JSON_THROW_ON_ERROR)) > 65536) {
                        throw new RuntimeException('Row exceeds 64 KiB.');
                    }
                    yield $number => $values;
                }
                break;
            }
        } finally {
            $reader->close();
        }
    }
}
