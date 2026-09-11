<?php

namespace Artur\PelicanServerConsolePro;

use Artur\PelicanServerConsolePro\Filament\Admin\Pages\ConsoleProSettingsPage;
use Filament\Contracts\Plugin;
use Filament\Panel;
use Filament\View\PanelsRenderHook;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\HtmlString;

class PelicanServerConsoleProPlugin implements Plugin
{
    public function getId(): string
    {
        return 'pelican-server-console-pro';
    }

    public function register(Panel $panel): void
    {
        $version = '1.5.3';

        if ($panel->getId() === 'server') {
            $panel->renderHook(
                PanelsRenderHook::HEAD_END,
                function () use ($version) {
                    $config = $this->loadConfig();
                    $i18n = trans('console-pro::messages');
                    return new HtmlString(
                        '<link rel="stylesheet" href="/plugins/pelican-server-console-pro/css/console-pro.css?v=' . $version . '&t=' . time() . '">' . "\n" .
                        '<script>' . "\n" .
                        'window.PelicanConsoleProConfig = ' . json_encode($config) . ';' . "\n" .
                        'window.PelicanConsoleProI18n = ' . json_encode($i18n, JSON_UNESCAPED_UNICODE) . ';' . "\n" .
                        '(function(){' . "\n" .
                        '  window.filamentChartJsPlugins = window.filamentChartJsPlugins || [];' . "\n" .
                        '  window.filamentChartJsPlugins.push({' . "\n" .
                        '    id: "pelicanZeroDots",' . "\n" .
                        '    beforeInit: function(chart) {' . "\n" .
                        '      if (chart.canvas && chart.canvas.id === "pm-history-chart-canvas") return;' . "\n" .
                        '      if (chart.options && chart.options.elements && chart.options.elements.point) {' . "\n" .
                        '        chart.options.elements.point.radius = 0;' . "\n" .
                        '        chart.options.elements.point.hoverRadius = 4;' . "\n" .
                        '        chart.options.elements.point.hitRadius = 10;' . "\n" .
                        '      }' . "\n" .
                        '      if (chart.data && chart.data.datasets) {' . "\n" .
                        '        chart.data.datasets.forEach(function(ds) {' . "\n" .
                        '          ds.pointRadius = 0; ds.radius = 0; ds.pointHoverRadius = 4; ds.pointHitRadius = 10; ds.pointBorderWidth = 0;' . "\n" .
                        '        });' . "\n" .
                        '      }' . "\n" .
                        '    },' . "\n" .
                        '    beforeUpdate: function(chart) {' . "\n" .
                        '      if (chart.canvas && chart.canvas.id === "pm-history-chart-canvas") return;' . "\n" .
                        '      if (chart.options && chart.options.elements && chart.options.elements.point) {' . "\n" .
                        '        chart.options.elements.point.radius = 0;' . "\n" .
                        '        chart.options.elements.point.hoverRadius = 4;' . "\n" .
                        '        chart.options.elements.point.hitRadius = 10;' . "\n" .
                        '      }' . "\n" .
                        '      if (chart.data && chart.data.datasets) {' . "\n" .
                        '        chart.data.datasets.forEach(function(ds) {' . "\n" .
                        '          ds.pointRadius = 0; ds.radius = 0; ds.pointHoverRadius = 4; ds.pointHitRadius = 10; ds.pointBorderWidth = 0;' . "\n" .
                        '        });' . "\n" .
                        '      }' . "\n" .
                        '    }' . "\n" .
                        '  });' . "\n" .
                        '  var OrigWS = window.WebSocket;' . "\n" .
                        '  if (OrigWS && !OrigWS._proHooked) {' . "\n" .
                        '    OrigWS._proHooked = true;' . "\n" .
                        '    class PelicanWebSocket extends OrigWS {' . "\n" .
                        '      constructor(...args) {' . "\n" .
                        '        super(...args);' . "\n" .
                        '        window._pelicanConsoleSocket = this;' . "\n" .
                        '        this.addEventListener("message", function(e) {' . "\n" .
                        '          try {' . "\n" .
                        '            var msg = JSON.parse(e.data);' . "\n" .
                        '            if (msg && msg.event === "stats" && msg.args && msg.args[0]) {' . "\n" .
                        '              var raw = msg.args[0];' . "\n" .
                        '              var statsObj = typeof raw === "string" ? JSON.parse(raw) : raw;' . "\n" .
                        '              window.dispatchEvent(new CustomEvent("pelican:server-stats", { detail: statsObj }));' . "\n" .
                        '            }' . "\n" .
                        '          } catch (err) {}' . "\n" .
                        '        });' . "\n" .
                        '      }' . "\n" .
                        '    }' . "\n" .
                        '    window.WebSocket = PelicanWebSocket;' . "\n" .
                        '  }' . "\n" .
                        '  var _xt = undefined;' . "\n" .
                        '  function patchXtermObj(val) {' . "\n" .
                        '    if (!val) return;' . "\n" .
                        '    val.WebglAddon = function() { this.activate = function(){}; this.dispose = function(){}; this.onContextLoss = function(){}; };' . "\n" .
                        '    if (val.Terminal && !val.Terminal._proOpenHooked) {' . "\n" .
                        '      val.Terminal._proOpenHooked = true;' . "\n" .
                        '      var origOpen = val.Terminal.prototype.open;' . "\n" .
                        '      val.Terminal.prototype.open = function(el) {' . "\n" .
                        '        window._pelicanTerminal = this;' . "\n" .
                        '        if (el) el._xterm = this;' . "\n" .
                        '        var rs = this._core ? this._core._renderService : null;' . "\n" .
                        '        if (rs) { rs._isPaused = false; }' . "\n" .
                        '        if (window.PelicanConsoleProInitTerminal) {' . "\n" .
                        '          try { window.PelicanConsoleProInitTerminal(this); } catch (e) {}' . "\n" .
                        '        }' . "\n" .
                        '        return origOpen.apply(this, arguments);' . "\n" .
                        '      };' . "\n" .
                        '    }' . "\n" .
                        '  }' . "\n" .
                        '  if (window.Xterm) { patchXtermObj(window.Xterm); }' . "\n" .
                        '  try {' . "\n" .
                        '    Object.defineProperty(window, "Xterm", {' . "\n" .
                        '      configurable: true,' . "\n" .
                        '      enumerable: true,' . "\n" .
                        '      get: function() { return _xt; },' . "\n" .
                        '      set: function(val) {' . "\n" .
                        '        _xt = val;' . "\n" .
                        '        patchXtermObj(val);' . "\n" .
                        '      }' . "\n" .
                        '    });' . "\n" .
                        '  } catch (e) {}' . "\n" .
                        '})();' . "\n" .
                        '</script>'
                    );
                }
            );

            $panel->renderHook(
                PanelsRenderHook::BODY_END,
                fn () => new HtmlString('<script src="/plugins/pelican-server-console-pro/js/console-pro.js?v=' . $version . '&t=' . time() . '" defer></script>')
            );
        }

        if ($panel->getId() === 'admin') {
            $panel->pages([
                ConsoleProSettingsPage::class,
            ]);
        }
    }

    public function boot(Panel $panel): void
    {
    }

    private function loadConfig(): array
    {
        $defaults = config('console-pro', [
            'colored_console' => true,
            'copy_on_select' => true,
            'quick_commands' => true,
            'autocomplete' => true,
            'pause_on_ctrl' => true,
            'pause_checkbox' => true,
            'commands' => [
                'status',
                'stats',
                'sm plugins list',
                'sm exts list',
                'sm_who',
                'sm_reloadadmins',
            ],
            'toast_duration' => 1500,
        ]);

        try {
            $rows = DB::table('settings')->where('key', 'like', 'console_pro::%')->get();
            foreach ($rows as $row) {
                $subKey = str_replace('console_pro::', '', $row->key);
                $decoded = json_decode($row->value, true);
                $defaults[$subKey] = ($decoded !== null) ? $decoded : $row->value;
            }
        } catch (\Throwable $e) {}

        return $defaults;
    }
}
