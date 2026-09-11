# ⚡ Pelican Server Console Pro

**English** | [Русский](#-русский)

A high-performance, feature-packed console enhancement suite for **Pelican Panel**, primarily designed and optimized for **Source Engine** dedicated game servers (*Team Fortress 2, Counter-Strike: Source, CS:GO, Garry's Mod, Half-Life 2: Deathmatch, Left 4 Dead 2, Day of Defeat: Source*, etc.).

---

## ✨ Features (English)

- **🎨 ANSI Syntax & Semantic Colorizer**:
  - Automatically highlights Source engine logs in real time: Errors & Crashes (Red), Warnings & Timeouts (Yellow), Success & Connects (Green), IP addresses (Cyan), Player Chat & Voice (Magenta), and Commands (White).
- **🎮 1-Click Steam Profile Resolver**:
  - Automatically turns Steam IDs into clickable links directly in the console (`[U:1:XXXXXX]`, `STEAM_0:X:YYYY`, and SteamID64). Clicking opens the player's Steam Community profile in a new tab.
- **⚡ Quick Commands Toolbar**:
  - Fast execution bar for common Source/SourceMod commands (`status`, `stats`, `sm plugins list`, `sm exts list`, `sm_who`, `sm_reloadadmins`).
  - Customizable custom commands modal (`+`) with local storage persistence.
  - Direct WebSocket execution with anti-duplicate debounce protection.
- **🔍 Autocomplete for Source Commands**:
  - Built-in suggestions for popular Source engine cvars and SourceMod admin commands as you type.
- **⏸️ Lossless Pause Engine**:
  - Hold `Ctrl` or toggle the pause checkbox to freeze terminal scrolling and examine logs while an active server runs. Incoming logs are preserved in memory and rendered smoothly when unpaused.
- **📋 Auto-Copy on Text Selection**:
  - Selecting any text inside the terminal instantly copies it to clipboard with a toast notification.
- **🔄 Resilient Livewire Reattachment**:
  - Automatically survives Filament/Livewire component morphing without detached terminal freezing.

---

## 🇷🇺 Описание (Русский)

**Pelican Server Console Pro** — профессиональный набор улучшений веб-консоли для панели **Pelican Panel**, специально разработанный и оптимизированный для серверов на движке **Source Engine** (*Team Fortress 2, Counter-Strike: Source, CS:GO, Garry's Mod, HL2:DM, L4D2* и др.).

### Основные возможности

- **🎨 Интеллектуальная ANSI-подсветка синтаксиса**:
  - Автоматическая подсветка логов Source в реальном времени: ошибки и падения (красный), предупреждения (желтый), успешные события и подключения (зеленый), IP-адреса (голубой), чат игроков (пурпурный), команды (белый).
- **🎮 Кликабельные SteamID в 1 клик**:
  - Автоматическое распознавание всех форматов SteamID (`[U:1:XXXXXX]`, `STEAM_0:X:YYYY`, SteamID64). Клик по SteamID мгновенно открывает страницу игрока в сообществе Steam.
- **⚡ Панель быстрых команд**:
  - Кнопки быстрого ввода популярных команд Source и SourceMod (`status`, `stats`, `sm plugins list`, `sm exts list`, `sm_who`, `sm_reloadadmins`).
  - Возможность добавления собственных кастомных команд через кнопку `+`.
  - Отправка напрямую через WebSocket с защитой от случайных повторных кликов.
- **🔍 Автодополнение команд Source**:
  - Всплывающее меню подсказок для популярных команд и консольных переменных движка Source при вводе.
- **⏸️ Пауза консоли без потери логов**:
  - Удержание клавиши `Ctrl` или переключатель «Пауза» замораживает вывод консоли для удобного чтения. Все входящие логи накапливаются в буфере и выводятся после снятия с паузы.
- **📋 Автокопирование выделенного текста**:
  - Выделение любого текста в терминале мышью сразу копирует его в буфер обмена с всплывающим уведомлением.
- **🔄 Устойчивость к обновлению Livewire**:
  - Защита от заморозки терминала при морфинге интерфейса Filament.

---

## 🚀 Installation / Установка

### ⚡ 1-Click Install via URL (Recommended) / Установка по ссылке
In Pelican Admin Panel -> **Plugins** -> click **«Import»** / **«Add Plugin»**, enter the URL:
```text
https://github.com/MrPanica/pelican-server-console-pro/archive/refs/heads/master.zip
```
Click **Install**. Pelican Panel will automatically download, unpack, and activate the plugin!

---

### 💻 Manual CLI Installation / Ручная установка через консоль
```bash
# Clone into Pelican plugins directory
cd /var/www/pelican/plugins
git clone https://github.com/MrPanica/pelican-server-console-pro.git

# Publish assets and clear cache
cd /var/www/pelican
php artisan filament:assets
php artisan view:clear
php artisan cache:clear
```

## 📄 License

MIT License. Developed for gaming communities running Source engine servers on Pelican Panel.
