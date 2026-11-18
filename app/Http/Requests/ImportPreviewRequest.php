<?php

namespace App\Http\Requests;

use App\Models\ImportBatch;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class ImportPreviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        $batch = $this->route('importBatch');

        if (! $batch instanceof ImportBatch || (int) $batch->workspace_id !== (int) $this->session()->get('active_workspace_id')) {
            abort(404);
        }

        return Gate::allows('update', $batch);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'mapping' => ['required', 'array'],
            'mapping.type' => ['required', 'integer', 'min:0'],
            'mapping.description' => ['required', 'integer', 'min:0'],
            'mapping.amount' => ['required', 'integer', 'min:0'],
            'mapping.date' => ['required', 'integer', 'min:0'],
            'mapping.date_format' => ['required', 'in:Y-m-d,d/m/Y,m/d/Y,d-m-Y'],
            'mapping.amount_format' => ['required', 'string', 'in:idr_dot,idr_comma,raw'],
            'mapping.account_id' => ['nullable', 'integer', 'min:1'],
            'mapping.category_id' => ['nullable', 'integer', 'min:1'],
            'mapping.source_account_id' => ['nullable', 'integer', 'min:1'],
            'mapping.destination_account_id' => ['nullable', 'integer', 'min:1'],
            'mapping.notes' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
