<?php

namespace App\Policies;

use App\Models\ImportBatch;
use App\Models\User;

class ImportBatchPolicy
{
    public function view(User $user, ImportBatch $batch): bool
    {
        return $batch->workspace->membershipFor($user) !== null;
    }

    public function create(User $user, mixed $workspace): bool
    {
        $member = $workspace->membershipFor($user);

        return $member !== null && $member->role !== 'viewer';
    }

    public function update(User $user, ImportBatch $batch): bool
    {
        $member = $batch->workspace->membershipFor($user);

        return $member !== null && $member->role !== 'viewer' && (in_array($member->role, ['owner', 'admin'], true) || (int) $batch->uploaded_by === (int) $user->id);
    }
}
