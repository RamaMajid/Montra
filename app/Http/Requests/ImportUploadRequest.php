<?php

namespace App\Http\Requests;

use App\Models\ImportBatch;
use App\Models\Workspace;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class ImportUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        $workspace = Workspace::query()->findOrFail((int) $this->session()->get('active_workspace_id'));

        return Gate::allows('create', [ImportBatch::class, $workspace]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'mimes:csv,txt,xlsx', 'max:10240'],
        ];
    }
}
