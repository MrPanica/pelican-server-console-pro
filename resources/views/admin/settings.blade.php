<x-filament-panels::page>
    <form wire:submit="saveSettings" class="space-y-6">
        {{ $this->form }}

        <div class="flex justify-start">
            <x-filament::button type="submit" size="lg">
                Сохранить настройки
            </x-filament::button>
        </div>
    </form>
</x-filament-panels::page>
