<?php

namespace Artur\PelicanServerConsolePro\Providers;

use Illuminate\Support\Facades\File;
use Illuminate\Support\ServiceProvider;

class PelicanServerConsoleProProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../../config/console-pro.php', 'console-pro');

        $this->ensureAssetsPublished();
    }

    public function boot(): void
    {
        $this->loadViewsFrom(__DIR__ . '/../../resources/views', 'console-pro');

        $sourceCss = __DIR__ . '/../../resources/css/console-pro.css';
        $destCss = public_path('plugins/pelican-server-console-pro/css/console-pro.css');

        $sourceJs = __DIR__ . '/../../resources/js/console-pro.js';
        $destJs = public_path('plugins/pelican-server-console-pro/js/console-pro.js');

        $this->publishes([
            $sourceCss => $destCss,
            $sourceJs => $destJs,
        ], 'pelican-server-console-pro-assets');
    }

    private function ensureAssetsPublished(): void
    {
        $pairs = [
            [__DIR__ . '/../../resources/css/console-pro.css', public_path('plugins/pelican-server-console-pro/css/console-pro.css')],
            [__DIR__ . '/../../resources/js/console-pro.js', public_path('plugins/pelican-server-console-pro/js/console-pro.js')],
        ];

        foreach ($pairs as [$source, $destination]) {
            if (File::exists($source) && (!File::exists($destination) || File::lastModified($source) > File::lastModified($destination))) {
                $dir = dirname($destination);
                if (!File::isDirectory($dir)) {
                    File::makeDirectory($dir, 0755, true);
                }
                File::copy($source, $destination);
            }
        }
    }
}
