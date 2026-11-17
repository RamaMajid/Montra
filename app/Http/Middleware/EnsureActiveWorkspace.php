<?php

namespace App\Http\Middleware;

use App\Actions\Workspaces\InitializeDefaultCategories;
use App\Actions\Workspaces\InitializePersonalWorkspace;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveWorkspace
{
    public function handle(Request $request, Closure $next): Response
    {
        $personal = app(InitializePersonalWorkspace::class)->for($request->user());
        $active = $request->user()->workspaceMemberships()->where('workspace_id', $request->session()->get('active_workspace_id'))->whereHas('workspace')->first();
        if (! $active) {
            $request->session()->put('active_workspace_id', $personal->id);
            $active = $personal->membershipFor($request->user());
        }

        app(InitializeDefaultCategories::class)->for($active->workspace);

        return $next($request);
    }
}
