<?php

return ['disk' => env('IMPORT_DISK', 'local'), 'retention_days' => (int) env('IMPORT_RETENTION_DAYS', 7), 'max_kilobytes' => 10240, 'chunk_size' => 100];
