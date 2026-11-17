<?php

namespace App\Http\Controllers;

use App\Actions\ManageCategory;
use App\Http\Requests\CategoryRequest;
use App\Models\Category;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class CategoryController extends Controller
{
    private function activeWorkspace(Request $request): Workspace
    {
        $id = (int) $request->session()->get('active_workspace_id');
        /** @var Workspace $workspace */
        $workspace = Workspace::query()->findOrFail($id);
        Gate::authorize('view', $workspace);

        return $workspace;
    }

    public function index(Request $request): Response
    {
        $workspace = $this->activeWorkspace($request);
        $categories = $workspace->categories()
            ->orderBy('type')
            ->orderBy('is_active', 'desc')
            ->orderBy('name')
            ->get()
            ->map(fn (Category $cat): array => [
                'id' => $cat->id,
                'name' => $cat->name,
                'type' => $cat->type->value,
                'description' => $cat->description,
                'color' => $cat->color,
                'icon' => $cat->icon,
                'is_default' => $cat->is_default,
                'is_active' => $cat->is_active,
            ])
            ->all();

        return Inertia::render('categories/index', [
            'categories' => $categories,
            'canManage' => Gate::allows('update', $workspace),
        ]);
    }

    public function store(CategoryRequest $request, ManageCategory $action): RedirectResponse
    {
        $workspace = $this->activeWorkspace($request);
        $action->save($request->user(), $workspace, $request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Category created.')]);

        return back();
    }

    public function update(CategoryRequest $request, Category $category, ManageCategory $action): RedirectResponse
    {
        $workspace = $this->activeWorkspace($request);
        $action->save($request->user(), $workspace, $request->validated(), $category);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Category updated.')]);

        return back();
    }

    public function archive(Request $request, Category $category, ManageCategory $action): RedirectResponse
    {
        $workspace = $this->activeWorkspace($request);
        $action->setActive($request->user(), $workspace, $category, false);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Category archived.')]);

        return back();
    }

    public function restore(Request $request, Category $category, ManageCategory $action): RedirectResponse
    {
        $workspace = $this->activeWorkspace($request);
        $action->setActive($request->user(), $workspace, $category, true);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Category restored.')]);

        return back();
    }
}
