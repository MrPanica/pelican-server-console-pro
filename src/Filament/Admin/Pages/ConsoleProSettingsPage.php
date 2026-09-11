<?php

namespace Artur\PelicanServerConsolePro\Filament\Admin\Pages;

use Filament\Actions\Action;
use Filament\Forms\Components\TagsInput;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Illuminate\Support\Facades\DB;

class ConsoleProSettingsPage extends Page implements HasForms
{
    use InteractsWithForms;

    protected string $view = 'console-pro::admin.settings';

    public ?array $data = [];

    public static function getNavigationIcon(): ?string
    {
        return 'tabler-terminal-2';
    }

    public static function getNavigationGroup(): ?string
    {
        return trans('console-pro::messages.nav_group');
    }

    public static function getNavigationLabel(): string
    {
        return trans('console-pro::messages.nav_label');
    }

    public function getTitle(): string
    {
        return trans('console-pro::messages.title');
    }

    public function mount(): void
    {
        $this->form->fill([
            'colored_console' => (bool) $this->getSetting('colored_console', true),
            'copy_on_select' => (bool) $this->getSetting('copy_on_select', true),
            'quick_commands' => (bool) $this->getSetting('quick_commands', true),
            'autocomplete' => (bool) $this->getSetting('autocomplete', true),
            'pause_on_ctrl' => (bool) $this->getSetting('pause_on_ctrl', true),
            'pause_checkbox' => (bool) $this->getSetting('pause_checkbox', true),
            'commands' => $this->getSetting('commands', [
                'status',
                'sm_who',
                'sm_players',
                'ping',
                'changelevel',
                'mp_restartgame 1',
                'tv_status',
                'maps *',
                'rcon',
            ]),
            'toast_duration' => (int) $this->getSetting('toast_duration', 1500),
        ]);
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make(trans('console-pro::messages.section_main'))
                    ->description(trans('console-pro::messages.section_main_desc'))
                    ->schema([
                        Toggle::make('colored_console')
                            ->label(trans('console-pro::messages.field_colored_console'))
                            ->helperText(trans('console-pro::messages.field_colored_console_help'))
                            ->default(true),
                        Toggle::make('copy_on_select')
                            ->label(trans('console-pro::messages.field_copy_on_select'))
                            ->helperText(trans('console-pro::messages.field_copy_on_select_help'))
                            ->default(true),
                        Toggle::make('quick_commands')
                            ->label(trans('console-pro::messages.field_quick_commands'))
                            ->helperText(trans('console-pro::messages.field_quick_commands_help'))
                            ->default(true),
                        Toggle::make('autocomplete')
                            ->label(trans('console-pro::messages.field_autocomplete'))
                            ->helperText(trans('console-pro::messages.field_autocomplete_help'))
                            ->default(true),
                    ])->columns(2),

                Section::make(trans('console-pro::messages.section_pause'))
                    ->description(trans('console-pro::messages.section_pause_desc'))
                    ->schema([
                        Toggle::make('pause_on_ctrl')
                            ->label(trans('console-pro::messages.field_pause_on_ctrl'))
                            ->helperText(trans('console-pro::messages.field_pause_on_ctrl_help'))
                            ->default(true),
                        Toggle::make('pause_checkbox')
                            ->label(trans('console-pro::messages.field_pause_checkbox'))
                            ->helperText(trans('console-pro::messages.field_pause_checkbox_help'))
                            ->default(true),
                    ])->columns(2),

                Section::make(trans('console-pro::messages.section_specific'))
                    ->schema([
                        TagsInput::make('commands')
                            ->label(trans('console-pro::messages.field_commands'))
                            ->helperText(trans('console-pro::messages.field_commands_help'))
                            ->default(['status', 'sm_who', 'sm_players', 'ping', 'changelevel', 'mp_restartgame 1', 'tv_status', 'maps *', 'rcon']),
                        TextInput::make('toast_duration')
                            ->label(trans('console-pro::messages.field_toast_duration'))
                            ->numeric()
                            ->default(1500),
                    ]),
            ])
            ->statePath('data');
    }

    public function saveSettings(): void
    {
        $state = $this->form->getState();

        foreach ($state as $key => $val) {
            $this->setSetting($key, $val);
        }

        Notification::make()
            ->title(trans('console-pro::messages.saved_notification'))
            ->success()
            ->send();
    }

    private function getSetting(string $key, mixed $default = null): mixed
    {
        try {
            $row = DB::table('settings')->where('key', 'console_pro::' . $key)->first();
            if (!$row) return $default;
            $val = json_decode($row->value, true);
            return $val !== null ? $val : $row->value;
        } catch (\Throwable $e) {
            return $default;
        }
    }

    private function setSetting(string $key, mixed $val): void
    {
        try {
            DB::table('settings')->updateOrInsert(
                ['key' => 'console_pro::' . $key],
                ['value' => is_array($val) || is_bool($val) ? json_encode($val) : (string) $val]
            );
        } catch (\Throwable $e) {}
    }
}
