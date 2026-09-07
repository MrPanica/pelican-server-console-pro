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
        return 'Настройки';
    }

    public static function getNavigationLabel(): string
    {
        return 'Console Pro';
    }

    public function getTitle(): string
    {
        return 'Настройки Pelican Console Pro';
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
                Section::make('Основные модули консоли')
                    ->description('Включение и отключение функций консоли серверов')
                    ->schema([
                        Toggle::make('colored_console')
                            ->label('Цветная консоль (подсветка логов)')
                            ->helperText('Выделяет цветом важные системные сообщения, ошибки, предупреждения, IP-адреса и чат.')
                            ->default(true),
                        Toggle::make('copy_on_select')
                            ->label('Копирование при выделении текста (ЛКМ)')
                            ->helperText('Автоматически копирует выделенный в терминале фрагмент в буфер обмена при отпускании левой кнопки мыши.')
                            ->default(true),
                        Toggle::make('quick_commands')
                            ->label('Панель быстрых команд под строкой ввода')
                            ->helperText('Отображает кнопки для часто используемых серверных команд.')
                            ->default(true),
                        Toggle::make('autocomplete')
                            ->label('Автодополнение и подсказки команд')
                            ->helperText('Показывает всплывающее меню вариантов при наборе команды в поле ввода.')
                            ->default(true),
                    ])->columns(2),

                Section::make('Пауза автообновления консоли')
                    ->description('Позволяет заморозить прокрутку и вывод новых строк без потери данных')
                    ->schema([
                        Toggle::make('pause_on_ctrl')
                            ->label('Пауза консоли при удержании клавиши CTRL')
                            ->helperText('Пока клавиша Ctrl удерживается, новые строки буферизуются. При отпускании накопленные строки выводятся в консоль.')
                            ->default(true),
                        Toggle::make('pause_checkbox')
                            ->label('Кнопка/чекбокс ручной паузы в интерфейсе')
                            ->helperText('Добавляет переключатель «⏸ Не обновлять консоль» рядом со строкой ввода.')
                            ->default(true),
                    ])->columns(2),

                Section::make('Специфические настройки')
                    ->schema([
                        TagsInput::make('commands')
                            ->label('Список быстрых команд')
                            ->helperText('Команды, отображаемые на кнопках под строкой ввода консоли.')
                            ->default(['status', 'sm_who', 'sm_players', 'ping', 'changelevel', 'mp_restartgame 1', 'tv_status', 'maps *', 'rcon']),
                        TextInput::make('toast_duration')
                            ->label('Длительность уведомления о копировании (мс)')
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
            ->title('Настройки Console Pro сохранены!')
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
