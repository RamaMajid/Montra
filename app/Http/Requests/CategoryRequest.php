<?php

namespace App\Http\Requests;

use App\Enums\CategoryType;
use App\Models\Category;
use App\Models\Workspace;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class CategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        /** @var Workspace $workspace */
        $workspace = Workspace::query()->findOrFail((int) $this->session()->get('active_workspace_id'));
        $category = $this->route('category');
        if ($category instanceof Category) {
            Gate::authorize('update', [$category, $workspace]);
        } else {
            Gate::authorize('update', $workspace);
        }

        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $category = $this->route('category');
        $categoryId = $category instanceof Category ? $category->id : null;

        return [
            'name' => ['required', 'string', 'max:255', function (string $attribute, mixed $value, Closure $fail) use ($categoryId): void {
                if (! is_string($value) || ! is_string($this->input('type'))) {
                    return;
                }
                $query = Category::query()
                    ->where('workspace_id', $this->session()->get('active_workspace_id'))
                    ->where('type', $this->input('type'))
                    ->whereRaw('lower(name) = lower(?)', [$value]);
                if ($categoryId) {
                    $query->whereKeyNot($categoryId);
                }
                if ($query->exists()) {
                    $fail('A category with this name and type already exists, including archived categories.');
                }
            }],
            'type' => ['required', Rule::enum(CategoryType::class), function (string $attribute, mixed $value, Closure $fail) use ($categoryId): void {
                if ($categoryId) {
                    /** @var Category $category */
                    $category = Category::query()->where('workspace_id', $this->session()->get('active_workspace_id'))->findOrFail((int) $categoryId);
                    if ($category->type->value !== $value) {
                        $fail('Category type cannot be changed.');
                    }
                }
            }],
            'description' => ['nullable', 'string', 'max:2000'],
            'icon' => ['nullable', 'string', 'max:64'],
            'color' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ];
    }
}
