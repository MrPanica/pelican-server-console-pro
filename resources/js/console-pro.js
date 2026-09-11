/**
 * Pelican Server Console Pro
 * Unified Console Suite:
 * - ANSI Syntax Colorizer (Error, Warn, Success, SteamID, Commands, Chat)
 * - Steam Profile Resolver & 1-Click Linkifier (Supports SteamID3 [U:1:X] / [U:1:X, SteamID2, SteamID64)
 * - Rock-Solid Auto-Scroll & Interactive Slider Dragging + Mouse Wheel Navigation
 * - Quick Commands with Instant Execution, Prelude Echo & [+] Custom Commands Modal
 * - Auto-Copy on Text Selection with Visual Toast
 * - Pause Engine (Ctrl key / Checkbox with lossless buffering)
 * - Autocomplete Dropdown for Source Engine Commands
 * Version 1.5.1
 */
(function () {
    const config = window.PelicanConsoleProConfig || {
        colored_console: true,
        copy_on_select: true,
        quick_commands: true,
        autocomplete: true,
        pause_on_ctrl: true,
        pause_checkbox: true,
        steam_links: true,
        commands: [
            'status',
            'stats',
            'sm plugins list',
            'sm exts list',
            'sm_who',
            'sm_reloadadmins'
        ],
        toast_duration: 1500
    };

    function getServerIdentifier() {
        const parts = window.location.pathname.split('/');
        const idx = parts.indexOf('server');
        if (idx !== -1 && parts[idx + 1]) {
            return parts[idx + 1];
        }
        return 'default';
    }

    // --- 1. STEAM PROFILE RESOLVER ---
    function steamIdToCommunityUrl(steamId) {
        if (!steamId) return null;
        steamId = steamId.trim();

        // SteamID3: [U:1:123456], U:1:123456, [U:1:123456 (unclosed bracket), [U:0:123456]
        const m3 = steamId.match(/\[?U:([0-1]):(\d+)\]?/i);
        if (m3) {
            try {
                const accId = BigInt(m3[2]);
                const sid64 = (76561197960265728n + accId).toString();
                return `https://steamcommunity.com/profiles/${sid64}`;
            } catch (e) {
                return `https://steamcommunity.com/profiles/${m3[0]}`;
            }
        }

        // SteamID2: STEAM_0:X:Y or STEAM_1:X:Y
        const m2 = steamId.match(/STEAM_[0-5]:([01]):(\d+)/i);
        if (m2) {
            try {
                const y = BigInt(m2[1]);
                const z = BigInt(m2[2]);
                const sid64 = (76561197960265728n + z * 2n + y).toString();
                return `https://steamcommunity.com/profiles/${sid64}`;
            } catch (e) {
                return null;
            }
        }

        // SteamID64: 7656119...
        const m64 = steamId.match(/7656119\d{10}/);
        if (m64) return `https://steamcommunity.com/profiles/${m64[0]}`;

        return null;
    }

    // --- 2. COLORED CONSOLE ANSI ENGINE ---
    const ANSI_RESET = '\u001b[0m';
    const ANSI_ERROR = '\u001b[1;91m';     // Bright Red
    const ANSI_WARN = '\u001b[1;93m';      // Bright Yellow
    const ANSI_SUCCESS = '\u001b[1;92m';   // Bright Green
    const ANSI_CYAN = '\u001b[1;96m';      // Bright Cyan (IPs)
    const ANSI_BLUE = '\u001b[1;94m';      // Bright Blue (SteamID)
    const ANSI_MAGENTA = '\u001b[1;95m';   // Bright Magenta (Chat / Voice)
    const ANSI_COMMAND = '\u001b[1;97m';   // Bright White (Commands)

    const colorRules = [
        // Errors & Crashes
        { regex: /\b(error|fatal|exception|crash|crashed|segfault|segmentation fault|killed|panic|critical|failed|failure|abort|aborted|denied|refused)\b/gi, color: ANSI_ERROR },
        // Warnings & Disconnections
        { regex: /\b(warn|warning|caution|timed out|timeout|deprecated|slow response|disconnect|dropped|hibernating)\b/gi, color: ANSI_WARN },
        // Success & Connected
        { regex: /\b(connected|connection established|listening on|ready|started|success|successfully|loaded successfully)\b/gi, color: ANSI_SUCCESS },
        // IP addresses with optional Port
        { regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d{1,5})?\b/g, color: ANSI_CYAN },
        // SteamIDs (supports unclosed bracket [U:1:123456 as well as closed [U:1:123456])
        { regex: /(?:\[?U:[0-1]:\d+\]?|\bSTEAM_[0-5]:[01]:\d+\b|\b7656119\d{10}\b)/gi, color: ANSI_BLUE },
        // Player Chat & Voice tags
        { regex: /(\[CHAT\]|say:|say_team:|\(TEAM\)|\(ALL\))/gi, color: ANSI_MAGENTA },
        // Source Engine Commands / CVars
        { regex: /\b(status|stats|changelevel|changelevel2|rcon|sm_\w+|mp_\w+|sv_\w+|tf_\w+)\b/gi, color: ANSI_COMMAND }
    ];

    function colorizeLine(line) {
        if (!config.colored_console || !line || typeof line !== 'string' || line.length < 3) return line;

        try {
            const trimmed = line.trim();
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                return line;
            }

            const parts = line.split(/(\u001b\[[0-9;]*[a-zA-Z])/g);
            for (let i = 0; i < parts.length; i += 2) {
                let token = parts[i];
                if (token && token.length >= 2) {
                    for (let j = 0; j < colorRules.length; j++) {
                        token = token.replace(colorRules[j].regex, (m) => colorRules[j].color + m + ANSI_RESET);
                    }
                    parts[i] = token;
                }
            }
            return parts.join('');
        } catch (err) {
            return line;
        }
    }

    // --- 3. STEAM ID DETECTION AT MOUSE & TOOLTIP ---
    function getSteamIdAtMouse(term, mouseEvent) {
        if (!term || !term.buffer || !term.buffer.active) return null;
        const termEl = document.getElementById('terminal');
        if (!termEl) return null;

        const screen = termEl.querySelector('.xterm-screen') || termEl;
        const rect = screen.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return null;
        const x = mouseEvent.clientX - rect.left;
        const y = mouseEvent.clientY - rect.top;
        if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;

        let cellW = term._core?._renderService?.dimensions?.actualCellWidth 
                 || term._core?._renderService?.dimensions?.css?.cell?.width;
        let cellH = term._core?._renderService?.dimensions?.actualCellHeight 
                 || term._core?._renderService?.dimensions?.css?.cell?.height;
        if (!cellW || !cellH) {
            cellW = rect.width / (term.cols || 80);
            cellH = rect.height / (term.rows || 24);
        }
        if (!cellW || !cellH || cellW <= 0 || cellH <= 0) return null;

        const col = Math.floor(x / cellW);
        const rowInScreen = Math.floor(y / cellH);
        const buffer = term.buffer.active;
        const lineIndex = buffer.viewportY + rowInScreen;
        const line = buffer.getLine(lineIndex);
        if (!line) return null;

        const text = line.translateToString(true);
        if (!text) return null;

        // Enhanced regex matching unclosed [U:1:123456 as well as closed [U:1:123456]
        const reSid = /(?:\[?U:[0-1]:\d+\]?|\bSTEAM_[0-5]:[01]:\d+\b|\b7656119\d{10}\b)/gi;
        const allMatches = [];
        let m;
        while ((m = reSid.exec(text)) !== null) {
            const sid = m[0];
            const url = steamIdToCommunityUrl(sid);
            if (url) {
                allMatches.push({
                    steamId: sid,
                    url: url,
                    start: m.index,
                    end: m.index + sid.length,
                    lineIndex: lineIndex
                });
            }
        }

        if (allMatches.length === 0) return null;

        for (const match of allMatches) {
            if (col >= match.start - 4 && col <= match.end + 4) {
                return match;
            }
        }

        if (allMatches.length === 1) {
            if (col >= allMatches[0].start - 14 && col <= allMatches[0].end + 14) {
                return allMatches[0];
            }
        }

        return null;
    }

    function isEventOverTerminal(e) {
        if (e.target && typeof e.target.closest === 'function') {
            const found = e.target.closest('#terminal, .xterm, .xterm-screen, .xterm-viewport, .xterm-scrollable-element');
            if (found) return true;
        }
        const termEl = document.getElementById('terminal');
        if (termEl) {
            const rect = termEl.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                return true;
            }
        }
        return false;
    }

    let mouseDownPos = { x: 0, y: 0, time: 0 };
    let isUserScrolledUp = false;
    let isDraggingSlider = false;

    window.addEventListener('mousedown', (e) => {
        mouseDownPos = { x: e.clientX, y: e.clientY, time: Date.now() };
    }, true);

    window.addEventListener('mousemove', (e) => {
        if (isDraggingSlider) return;
        if (!isEventOverTerminal(e)) {
            const tooltip = document.getElementById('pelican-steam-tooltip');
            if (tooltip) tooltip.style.display = 'none';
            return;
        }

        const term = window._pelicanTerminal || (document.getElementById('terminal')?._xterm);
        if (!term) return;

        const match = getSteamIdAtMouse(term, e);
        const termEl = document.getElementById('terminal');
        let tooltip = document.getElementById('pelican-steam-tooltip');

        if (match && match.url) {
            if (termEl) termEl.style.cursor = 'pointer';
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.id = 'pelican-steam-tooltip';
                document.body.appendChild(tooltip);
            }
            tooltip.innerHTML = `🎮 Steam: <span class="tooltip-sid">${match.steamId}</span> (клик для профиля)`;
            tooltip.style.left = `${Math.min(e.clientX + 14, window.innerWidth - 280)}px`;
            tooltip.style.top = `${e.clientY + 14}px`;
            tooltip.style.display = 'block';
        } else {
            if (termEl && !e.target.closest('.scrollbar.vertical, .slider')) termEl.style.cursor = '';
            if (tooltip) tooltip.style.display = 'none';
        }
    }, { passive: true });

    window.addEventListener('click', (e) => {
        if (e.button !== 0) return;
        if (!isEventOverTerminal(e)) return;
        if (e.target.closest('.scrollbar.vertical, .slider')) return;

        const dx = Math.abs(e.clientX - mouseDownPos.x);
        const dy = Math.abs(e.clientY - mouseDownPos.y);
        if (dx > 6 || dy > 6) return;

        const sel = window.getSelection ? window.getSelection().toString() : '';
        if (sel && sel.trim().length > 0) return;

        const term = window._pelicanTerminal || (document.getElementById('terminal')?._xterm);
        if (!term) return;

        const match = getSteamIdAtMouse(term, e);
        if (match && match.url) {
            e.preventDefault();
            e.stopPropagation();
            window.open(match.url, '_blank', 'noopener,noreferrer');
            showCopyToast(match.steamId.length, `🎮 Открыт профиль Steam: ${match.steamId}`);
        }
    }, true);

    // --- 4. SLIDER SYNCHRONIZATION & INTERACTIVE DRAGGING ---
    function getOrCreateScrollbarElements() {
        let track = document.getElementById('pelican-custom-scroll-track') || document.querySelector('.scrollbar.vertical');
        let slider = document.getElementById('pelican-custom-scroll-slider') || (track ? track.querySelector('.slider') : null);

        if (!track) {
            const termEl = document.getElementById('terminal');
            if (termEl) {
                termEl.style.position = 'relative';
                track = document.createElement('div');
                track.id = 'pelican-custom-scroll-track';
                track.className = 'pelican-custom-scroll-track';
                
                slider = document.createElement('div');
                slider.id = 'pelican-custom-scroll-slider';
                slider.className = 'pelican-custom-scroll-slider';
                
                track.appendChild(slider);
                termEl.appendChild(track);
            }
        }
        return { track, slider };
    }

    function syncSliderFromBuffer(term) {
        if (!term || !term.buffer || !term.buffer.active) return;
        const b = term.buffer.active;
        const { track, slider } = getOrCreateScrollbarElements();
        if (!track || !slider) return;

        const trackHeight = track.clientHeight || 540;
        const totalLines = Math.max(term.rows || 24, b.baseY + (term.rows || 24));
        const visibleRatio = Math.min(1, (term.rows || 24) / totalLines);
        const sliderHeight = Math.max(28, Math.round(visibleRatio * trackHeight));
        const usableTrack = Math.max(1, trackHeight - sliderHeight);

        const scrollRatio = b.baseY > 0 ? Math.max(0, Math.min(1, b.viewportY / b.baseY)) : 1;
        const sliderTop = Math.round(scrollRatio * usableTrack);

        slider.style.top = `${sliderTop}px`;
        slider.style.height = `${sliderHeight}px`;
        slider.style.display = b.baseY > 0 ? 'block' : 'none';
        track.style.display = b.baseY > 0 ? 'block' : 'none';
    }

    function initInteractiveScrollbar() {
        const { track, slider } = getOrCreateScrollbarElements();
        if (!track || !slider || track._pelicanInteractiveInit) return;
        track._pelicanInteractiveInit = true;

        track.style.pointerEvents = 'auto';
        track.style.cursor = 'pointer';
        slider.style.pointerEvents = 'auto';
        slider.style.cursor = 'grab';

        // Track click (jump to position)
        track.addEventListener('mousedown', (e) => {
            if (e.target === slider || slider.contains(e.target)) return;
            e.preventDefault();
            e.stopPropagation();

            const term = window._pelicanTerminal || (document.getElementById('terminal')?._xterm);
            if (!term || !term.buffer || !term.buffer.active) return;
            const b = term.buffer.active;
            if (b.baseY <= 0) return;

            const rect = track.getBoundingClientRect();
            const clickY = e.clientY - rect.top;
            const ratio = Math.max(0, Math.min(1, clickY / rect.height));
            const targetLine = Math.round(ratio * b.baseY);

            if (targetLine >= b.baseY - 2) {
                term.scrollToBottom();
            } else {
                term.scrollToLine(targetLine);
            }
            syncSliderFromBuffer(term);
            const curRs1 = term._core ? term._core._renderService : null;
            if (curRs1 && typeof curRs1.refreshRows === 'function') {
                curRs1._isPaused = false;
                curRs1.refreshRows(0, (curRs1._rowCount || term.rows || 24) - 1);
            }
        });

        // Slider drag
        slider.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const term = window._pelicanTerminal || (document.getElementById('terminal')?._xterm);
            if (!term || !term.buffer || !term.buffer.active) return;
            const b = term.buffer.active;
            if (b.baseY <= 0) return;

            isDraggingSlider = true;
            slider.style.cursor = 'grabbing';
            slider.classList.add('active');

            const trackRect = track.getBoundingClientRect();
            const startMouseY = e.clientY;
            const startViewportY = b.viewportY;
            const sliderH = slider.offsetHeight || 30;
            const usableTrack = Math.max(1, trackRect.height - sliderH);

            function onMouseMove(moveEvent) {
                moveEvent.preventDefault();
                const deltaY = moveEvent.clientY - startMouseY;
                const linesDelta = Math.round((deltaY / usableTrack) * b.baseY);
                const targetLine = Math.max(0, Math.min(b.baseY, startViewportY + linesDelta));

                if (targetLine >= b.baseY - 2) {
                    term.scrollToBottom();
                } else {
                    term.scrollToLine(targetLine);
                }
                syncSliderFromBuffer(term);
                const curRs2 = term._core ? term._core._renderService : null;
                if (curRs2 && typeof curRs2.refreshRows === 'function') {
                    curRs2._isPaused = false;
                    curRs2.refreshRows(0, (curRs2._rowCount || term.rows || 24) - 1);
                }
            }

            function onMouseUp() {
                isDraggingSlider = false;
                slider.style.cursor = 'grab';
                slider.classList.remove('active');
                window.removeEventListener('mousemove', onMouseMove, true);
                window.removeEventListener('mouseup', onMouseUp, true);
                if (term && term.buffer && term.buffer.active) {
                    if (term.buffer.active.viewportY >= term.buffer.active.baseY - 2) {
                        try { term.scrollToBottom(); } catch (err) {}
                    }
                }
            }

            window.addEventListener('mousemove', onMouseMove, true);
            window.addEventListener('mouseup', onMouseUp, true);
        });
    }

    // --- 5. SMOOTH MOUSE WHEEL SCROLLING & AUTO-SCROLL RECOVERY ---
    window.addEventListener('wheel', (e) => {
        if (!isEventOverTerminal(e)) return;

        const term = window._pelicanTerminal || (document.getElementById('terminal')?._xterm);
        if (!term || !term.buffer || !term.buffer.active) return;
        const b = term.buffer.active;
        if (!b) return;

        const delta = e.deltaY;
        if (delta === 0) return;

        // Proportional line scroll
        const lineDelta = Math.round(delta / 30) || (delta > 0 ? 1 : -1);
        term.scrollLines(lineDelta);

        // Snap to bottom if user scrolled near bottom
        if (b.viewportY >= b.baseY - 2) {
            try { term.scrollToBottom(); } catch (err) {}
        }
        syncSliderFromBuffer(term);

        const curRsWheel = term._core ? term._core._renderService : null;
        if (curRsWheel && typeof curRsWheel.refreshRows === 'function') {
            curRsWheel._isPaused = false;
            curRsWheel.refreshRows(0, (curRsWheel._rowCount || term.rows || 24) - 1);
        }

        e.preventDefault();
        e.stopPropagation();
    }, { passive: false, capture: true });

    // --- 6. PAUSE ENGINE (Ctrl key & Freeze Button / Checkbox with lossless buffering) ---
    let isCtrlHeld = false;
    let isManualPaused = false;
    let isConsolePaused = false;
    const consoleBuffer = [];
    let origTerminalWriteln = null;

    function updatePauseIndicator() {
        const badge = document.getElementById('pelican-pause-badge');
        const btn = document.getElementById('pelican-pause-btn');
        const cb = document.getElementById('pelican-pause-cb');

        if (cb && cb.checked !== isManualPaused) {
            cb.checked = isManualPaused;
        }

        if (btn) {
            if (isConsolePaused) {
                btn.classList.add('is-paused');
                btn.innerHTML = `<span class="pause-icon">▶</span> <span class="pause-text">Возобновить</span>`;
                btn.setAttribute('title', 'Возобновить обновление консоли и сбросить накопленный буфер');
            } else {
                btn.classList.remove('is-paused');
                btn.innerHTML = `<span class="pause-icon">⏸</span> <span class="pause-text">Заморозить (Ctrl)</span>`;
                btn.setAttribute('title', 'Заморозить поток консоли (также можно зажать клавишу Ctrl)');
            }
        }

        if (!badge) return;

        if (isConsolePaused) {
            badge.style.display = 'inline-flex';
            const count = consoleBuffer.length;
            const hint = isCtrlHeld ? 'зажат Ctrl' : 'заморозка включена';
            badge.innerHTML = `⏸ Заморожено: ${count} в буфере (${hint})`;
        } else {
            badge.style.display = 'none';
        }
    }

    function setConsolePaused(paused) {
        if (isConsolePaused === paused) {
            updatePauseIndicator();
            return;
        }

        isConsolePaused = paused;
        updatePauseIndicator();

        if (!isConsolePaused && consoleBuffer.length > 0) {
            const term = window._pelicanTerminal;
            while (consoleBuffer.length > 0) {
                const item = consoleBuffer.shift();
                try {
                    if (origTerminalWriteln) {
                        origTerminalWriteln.apply(item.instance || term, item.args);
                    } else if (term && term.writeln) {
                        term.writeln.apply(term, item.args);
                    }
                } catch (e) {}
            }
            if (term) {
                try { term.scrollToBottom(); } catch (e) {}
                syncSliderFromBuffer(term);
                const curRs = term._core ? term._core._renderService : null;
                if (curRs && typeof curRs.refreshRows === 'function') {
                    curRs._isPaused = false;
                    curRs.refreshRows(0, (curRs._rowCount || term.rows || 24) - 1);
                }
            }
            updatePauseIndicator();
        }
    }

    function toggleManualPause() {
        isManualPaused = !isManualPaused;
        setConsolePaused(isManualPaused || isCtrlHeld);
    }

    function handleCtrlDown(e) {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
            return;
        }
        if ((e.key === 'Control' || e.keyCode === 17) && !isCtrlHeld) {
            isCtrlHeld = true;
            setConsolePaused(true);
        }
    }

    function handleCtrlUp(e) {
        if (e.key === 'Control' || e.keyCode === 17 || !e.ctrlKey) {
            if (isCtrlHeld) {
                isCtrlHeld = false;
                if (!isManualPaused) {
                    setConsolePaused(false);
                }
            }
        }
    }

    function initKeyboardHooks() {
        if (config.pause_on_ctrl && !window._pelicanCtrlHooksAttached) {
            window._pelicanCtrlHooksAttached = true;

            window.addEventListener('keydown', handleCtrlDown, { capture: true, passive: true });
            document.addEventListener('keydown', handleCtrlDown, { capture: true, passive: true });

            window.addEventListener('keyup', handleCtrlUp, { capture: true, passive: true });
            document.addEventListener('keyup', handleCtrlUp, { capture: true, passive: true });

            window.addEventListener('mousemove', (e) => {
                if (isCtrlHeld && !e.ctrlKey) {
                    isCtrlHeld = false;
                    if (!isManualPaused) {
                        setConsolePaused(false);
                    }
                }
            }, { passive: true });

            window.addEventListener('blur', () => {
                if (isCtrlHeld) {
                    isCtrlHeld = false;
                    if (!isManualPaused) {
                        setConsolePaused(false);
                    }
                }
            });

            window.addEventListener('focus', () => {
                if (isCtrlHeld) {
                    isCtrlHeld = false;
                    if (!isManualPaused) {
                        setConsolePaused(false);
                    }
                }
            });

            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    if (isCtrlHeld) {
                        isCtrlHeld = false;
                        if (!isManualPaused) {
                            setConsolePaused(false);
                        }
                    }
                } else {
                    // Tab returned from background: snap immediately to current bottom
                    const term = window._pelicanTerminal || (document.getElementById('terminal')?._xterm);
                    if (term) {
                        const rs = term._core ? term._core._renderService : null;
                        if (rs) {
                            rs._isPaused = false;
                        }
                        if (!isUserScrolledUp && !isConsolePaused) {
                            try { term.scrollToBottom(); } catch (e) {}
                        }
                        syncSliderFromBuffer(term);
                        const curRs = term._core ? term._core._renderService : null;
                        if (curRs && typeof curRs.refreshRows === 'function') {
                            try { curRs.refreshRows(0, (curRs._rowCount || term.rows || 24) - 1); } catch (e) {}
                        }
                    }
                }
            });
        }
    }

    // --- 7. TERMINAL WRITELN & HOOKS ---
    function ensureTerminalAttached(targetTerm) {
        const liveTerm = document.getElementById('terminal');
        const term = targetTerm || window._pelicanTerminal || (liveTerm ? liveTerm._xterm : null);
        if (!liveTerm || !term || !term.element) return;

        if (!term.element.isConnected || term.element.parentElement !== liveTerm) {
            const deadXterms = liveTerm.querySelectorAll('.terminal.xterm');
            for (const dead of deadXterms) {
                if (dead !== term.element) {
                    dead.remove();
                }
            }
            if (term.element.parentElement !== liveTerm) {
                liveTerm.appendChild(term.element);
            }
            liveTerm._xterm = term;
            window._pelicanTerminal = term;

            const rs = term._core ? term._core._renderService : null;
            if (rs) {
                rs._isPaused = false;
                if (typeof rs.refreshRows === 'function') {
                    try { rs.refreshRows(0, (rs._rowCount || term.rows || 24) - 1); } catch (e) {}
                }
            }
            if (typeof term.refresh === 'function') {
                try { term.refresh(0, term.rows - 1); } catch (e) {}
            }
            if (typeof term.scrollToBottom === 'function' && !isUserScrolledUp) {
                try { term.scrollToBottom(); } catch (e) {}
            }
        }
    }

    function patchTerminalInstance(term) {
        if (!term || term._proPatched) return;
        term._proPatched = true;
        window._pelicanTerminal = term;
        ensureTerminalAttached(term);

        const rs = term._core ? term._core._renderService : null;
        if (rs) {
            rs._isPaused = false;
            const origHandleIntersection = rs._handleIntersectionChange;
            rs._handleIntersectionChange = function(entries) {
                this._isPaused = false;
                if (typeof origHandleIntersection === 'function') {
                    try { origHandleIntersection.call(this, entries); } catch (e) {}
                }
                this._isPaused = false;
                if (this._needsFullRefresh) {
                    this.refreshRows(0, (this._rowCount || term.rows || 24) - 1);
                    this._needsFullRefresh = false;
                }
            };
        }

        // Hook Xterm key event handler to capture CTRL key events even when terminal has focus
        if (typeof term.attachCustomKeyEventHandler === 'function' && !term._ctrlCustomKeyHooked) {
            term._ctrlCustomKeyHooked = true;
            term.attachCustomKeyEventHandler((e) => {
                if (e.key === 'Control' || e.keyCode === 17) {
                    if (e.type === 'keydown') {
                        handleCtrlDown(e);
                    } else if (e.type === 'keyup') {
                        handleCtrlUp(e);
                    }
                }
                return true;
            });
        }

        if (typeof term.onScroll === 'function' && !term._scrollHooked) {
            term._scrollHooked = true;
            term.onScroll(() => {
                if (term.buffer && term.buffer.active) {
                    const b = term.buffer.active;
                    isUserScrolledUp = b.viewportY < b.baseY - 2;
                }
                syncSliderFromBuffer(term);
            });
        }

        // Native Xterm Link Provider for 100% accurate Steam Profile linkification
        if (typeof term.registerLinkProvider === 'function' && !term._steamLinkProviderRegistered) {
            term._steamLinkProviderRegistered = true;
            term.registerLinkProvider({
                provideLinks: function (lineNumber, callback) {
                    const line = term.buffer.active.getLine(lineNumber - 1);
                    if (!line) { callback(null); return; }
                    const text = line.translateToString(true);
                    if (!text) { callback(null); return; }

                    const links = [];
                    const re = /(?:\[?U:[0-1]:\d+\]?|\bSTEAM_[0-5]:[01]:\d+\b|\b7656119\d{10}\b)/gi;
                    let m;
                    while ((m = re.exec(text)) !== null) {
                        const sid = m[0];
                        const url = steamIdToCommunityUrl(sid);
                        if (url) {
                            links.push({
                                text: sid,
                                range: {
                                    start: { x: m.index + 1, y: lineNumber },
                                    end: { x: m.index + sid.length, y: lineNumber }
                                },
                                activate: function () {
                                    window.open(url, '_blank', 'noopener,noreferrer');
                                    showCopyToast(sid.length, `🎮 Открыт профиль Steam: ${sid}`);
                                }
                            });
                        }
                    }
                    callback(links);
                }
            });
        }

        let scrollRafId = null;
        function scheduleScrollUpdate(t) {
            if (scrollRafId) return;
            scrollRafId = requestAnimationFrame(() => {
                scrollRafId = null;
                const activeTerm = t || term || window._pelicanTerminal;
                if (!activeTerm) return;
                if (!isUserScrolledUp && !isConsolePaused) {
                    try { activeTerm.scrollToBottom(); } catch (e) {}
                }
                syncSliderFromBuffer(activeTerm);
                const curRs = activeTerm._core ? activeTerm._core._renderService : null;
                if (curRs && typeof curRs.refreshRows === 'function') {
                    curRs._isPaused = false;
                    curRs.refreshRows(0, (curRs._rowCount || activeTerm.rows || 24) - 1);
                }
            });
        }

        origTerminalWriteln = term.writeln;
        term.writeln = function (...args) {
            ensureTerminalAttached(this);
            if (args.length > 0 && typeof args[0] === 'string') {
                args[0] = colorizeLine(args[0]);
            }

            if (isConsolePaused) {
                consoleBuffer.push({ instance: this, args: args });
                if (consoleBuffer.length > 5000) consoleBuffer.shift();
                updatePauseIndicator();
                return;
            }

            // Hook callback for when Xterm finishes adding chunk to buffer
            const lastArg = args[args.length - 1];
            const hasUserCb = typeof lastArg === 'function';
            const userCb = hasUserCb ? lastArg : null;

            const onDone = () => {
                scheduleScrollUpdate(this);
                if (userCb) userCb();
            };

            if (hasUserCb) {
                args[args.length - 1] = onDone;
            } else {
                args.push(onDone);
            }

            const res = origTerminalWriteln.apply(this, args);
            scheduleScrollUpdate(this);
            return res;
        };

        if (typeof term.onSelectionChange === 'function' && !term._selectionChangeHooked) {
            term._selectionChangeHooked = true;
            term.onSelectionChange(() => {
                setTimeout(handleTerminalAutoCopy, 80);
            });
        }

        setTimeout(() => {
            try { term.scrollToBottom(); } catch (e) {}
            syncSliderFromBuffer(term);
            initInteractiveScrollbar();
        }, 100);
    }

    window.PelicanConsoleProInitTerminal = function (term) {
        patchTerminalInstance(term);
    };

    function hookGlobalXterm() {
        if (window.Xterm) {
            window.Xterm.WebglAddon = function () {
                this.activate = function () {};
                this.dispose = function () {};
                this.onContextLoss = function () {};
            };
        }

        if (window.Xterm && window.Xterm.Terminal && !window.Xterm.Terminal._proGlobalHooked) {
            window.Xterm.Terminal._proGlobalHooked = true;
            const OrigTermProto = window.Xterm.Terminal.prototype;
            const origOpen = OrigTermProto.open;
            OrigTermProto.open = function (el) {
                window._pelicanTerminal = this;
                if (el) el._xterm = this;
                patchTerminalInstance(this);
                return origOpen.apply(this, arguments);
            };
        }

        if (window._pelicanTerminal) {
            patchTerminalInstance(window._pelicanTerminal);
        } else {
            const termEl = document.getElementById('terminal');
            if (termEl && termEl._xterm) {
                patchTerminalInstance(termEl._xterm);
            }
        }
    }

    // --- 8. AUTO-COPY ON TEXT SELECTION ---
    let toastTimeout = null;
    function showCopyToast(len, customText) {
        let toast = document.getElementById('pelican-copy-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'pelican-copy-toast';
            document.body.appendChild(toast);
        }

        toast.textContent = customText || `📋 Скопировано в буфер (${len} симв.)`;
        toast.classList.add('show');

        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, config.toast_duration || 1500);
    }

    function fallbackCopy(text) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            ta.style.top = '-9999px';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            const res = document.execCommand('copy');
            document.body.removeChild(ta);
            if (res) {
                showCopyToast(text.length);
            }
        } catch (e) {}
    }

    function copyToClipboard(text) {
        if (!text) return;
        showCopyToast(text.length);
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).catch(() => {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    function handleTerminalAutoCopy() {
        let sel = '';
        const term = window._pelicanTerminal;
        if (term && typeof term.getSelection === 'function') {
            sel = term.getSelection();
        }

        if (!sel || !sel.trim()) {
            const domSel = window.getSelection ? window.getSelection().toString() : '';
            if (domSel && domSel.trim()) {
                const termEl = document.getElementById('terminal');
                if (termEl && window.getSelection().anchorNode && termEl.contains(window.getSelection().anchorNode)) {
                    sel = domSel;
                }
            }
        }

        sel = sel ? sel.trim() : '';
        if (sel.length > 0 && sel !== window._pelicanLastCopiedText) {
            window._pelicanLastCopiedText = sel;
            copyToClipboard(sel);
        }
    }

    function initCopyOnSelect() {
        if (!config.copy_on_select || window._pelicanCopyOnSelectInit) return;
        window._pelicanCopyOnSelectInit = true;

        document.addEventListener('mouseup', () => {
            setTimeout(handleTerminalAutoCopy, 50);
        });
    }

    // --- 9. QUICK COMMANDS: INSERTION & INSTANT EXECUTION ---
    function fillCommand(cmd) {
        const input = document.getElementById('send-command');
        if (!input) return;
        input.value = cmd.endsWith(' ') ? cmd : cmd + ' ';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.focus();
    }

    let lastCommandSent = '';
    let lastCommandTime = 0;

    function sendCommand(cmd, shouldEcho = true) {
        if (!cmd || !cmd.trim()) return;
        cmd = cmd.trim();

        // 1. Debounce rapid double-clicks (ignore duplicate clicks within 400ms)
        const now = Date.now();
        if (cmd === lastCommandSent && (now - lastCommandTime) < 400) {
            return;
        }
        lastCommandSent = cmd;
        lastCommandTime = now;

        // 2. Clear scrolled-up state so incoming logs stay at bottom
        isUserScrolledUp = false;
        ensureTerminalAttached();
        const term = window._pelicanTerminal || (document.getElementById('terminal')?._xterm);
        if (term) {
            if (shouldEcho) {
                term.writeln(`\u001b[1;33m> ${cmd}\u001b[0m`);
            }
            try { term.scrollToBottom(); } catch (e) {}
            syncSliderFromBuffer(term);
        }

        // 3. Add to command history for autocomplete
        addCommandToHistory(cmd);

        // 4. Clear input field if it has this command
        const input = document.getElementById('send-command');
        if (input && input.value === cmd) {
            input.value = '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // 5. Send EXACTLY ONCE via the official Wings WebSocket
        const ws = window._pelicanConsoleSocket;
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({
                    event: 'send command',
                    args: [cmd]
                }));
                return; // SENT! Stop execution, DO NOT call Livewire or dispatch enter events!
            } catch (err) {
                console.warn('Pelican Console Pro: Direct WS send error:', err);
            }
        }

        // 6. Fallback ONLY if WebSocket is not open
        if (window.Livewire) {
            try {
                window.Livewire.dispatch('sendServerCommand', { command: cmd });
            } catch (e) {}
        }
    }

    function getCustomCommands() {
        const sId = getServerIdentifier();
        const key = `pelican_custom_qc_${sId}`;
        try {
            const val = localStorage.getItem(key);
            return val ? JSON.parse(val) : [];
        } catch (e) {
            return [];
        }
    }

    function saveCustomCommands(list) {
        const sId = getServerIdentifier();
        const key = `pelican_custom_qc_${sId}`;
        try {
            localStorage.setItem(key, JSON.stringify(list));
        } catch (e) {}
    }

    function getCommandHistory() {
        const sId = getServerIdentifier();
        const key = `pelican_cmd_history_${sId}`;
        try {
            const val = localStorage.getItem(key);
            return val ? JSON.parse(val) : [];
        } catch (e) {
            return [];
        }
    }

    function addCommandToHistory(cmd) {
        if (!cmd || !cmd.trim()) return;
        cmd = cmd.trim();
        const sId = getServerIdentifier();
        const key = `pelican_cmd_history_${sId}`;
        try {
            let hist = getCommandHistory();
            hist = hist.filter(c => c.toLowerCase() !== cmd.toLowerCase());
            hist.unshift(cmd);
            if (hist.length > 50) hist = hist.slice(0, 50);
            localStorage.setItem(key, JSON.stringify(hist));
        } catch (e) {}
    }

    // Modal for adding / managing custom commands
    function openCustomCommandsModal() {
        let modalBackdrop = document.getElementById('pelican-qc-modal');
        if (!modalBackdrop) {
            modalBackdrop = document.createElement('div');
            modalBackdrop.id = 'pelican-qc-modal';
            modalBackdrop.className = 'pelican-qc-modal-backdrop';

            modalBackdrop.innerHTML = `
                <div class="pelican-qc-modal">
                    <div class="pelican-qc-modal-header">
                        <h4>Настройка быстрых команд</h4>
                        <button type="button" class="pelican-qc-modal-close" id="pelican-qc-close-btn">&times;</button>
                    </div>
                    <div class="pelican-qc-modal-body">
                        <div class="pelican-qc-field">
                            <label for="pelican-qc-input-cmd">Команда сервера (консольная):</label>
                            <input type="text" id="pelican-qc-input-cmd" placeholder="Например: changelevel de_mirage" autocomplete="off">
                            <small>Команда, которая будет мгновенно отправлена в консоль сервера.</small>
                        </div>
                        <div class="pelican-qc-field">
                            <label for="pelican-qc-input-alias">Псевдоним (отображаемое имя кнопки, опционально):</label>
                            <input type="text" id="pelican-qc-input-alias" placeholder="Например: Mirage" autocomplete="off">
                            <small>Если псевдоним задан, он будет показан на кнопке, иначе — сама команда.</small>
                        </div>
                        <div style="display: flex; justify-content: flex-end;">
                            <button type="button" class="pelican-qc-btn-save" id="pelican-qc-add-btn">+ Добавить в список</button>
                        </div>
                        <div class="pelican-qc-custom-list" id="pelican-qc-custom-items"></div>
                    </div>
                    <div class="pelican-qc-modal-footer">
                        <button type="button" class="pelican-qc-btn-cancel" id="pelican-qc-done-btn">Готово</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modalBackdrop);

            const close = () => {
                modalBackdrop.classList.remove('show');
                modalBackdrop.style.display = 'none';
                rebuildQuickButtons();
            };

            const closeBtn = modalBackdrop.querySelector('#pelican-qc-close-btn');
            if (closeBtn) closeBtn.addEventListener('click', close);

            const doneBtn = modalBackdrop.querySelector('#pelican-qc-done-btn');
            if (doneBtn) doneBtn.addEventListener('click', close);

            modalBackdrop.addEventListener('click', (e) => {
                if (e.target === modalBackdrop) close();
            });

            const cmdInp = modalBackdrop.querySelector('#pelican-qc-input-cmd');
            const aliasInp = modalBackdrop.querySelector('#pelican-qc-input-alias');
            const addBtn = modalBackdrop.querySelector('#pelican-qc-add-btn');

            if (addBtn) {
                addBtn.addEventListener('click', () => {
                    const cmd = cmdInp ? cmdInp.value.trim() : '';
                    const alias = aliasInp ? aliasInp.value.trim() : '';
                    if (!cmd) {
                        if (cmdInp) cmdInp.focus();
                        return;
                    }

                    const list = getCustomCommands();
                    list.push({ command: cmd, alias: alias });
                    saveCustomCommands(list);

                    if (cmdInp) cmdInp.value = '';
                    if (aliasInp) aliasInp.value = '';
                    renderCustomListInModal();
                    rebuildQuickButtons();
                });
            }
        }

        renderCustomListInModal();
        modalBackdrop.classList.add('show');
        modalBackdrop.style.display = 'flex';
        const cmdInp = modalBackdrop.querySelector('#pelican-qc-input-cmd');
        if (cmdInp) cmdInp.focus();
    }

    window.PelicanOpenCustomCommandsModal = openCustomCommandsModal;
    window.PelicanConsolePro = {
        showCopyToast,
        sendCommand,
        fillCommand,
        openCustomCommandsModal,
        colorizeLine,
        setConsolePaused,
        toggleManualPause,
        updatePauseIndicator,
        syncSliderFromBuffer,
        getPauseState: () => ({ isManualPaused, isConsolePaused, isCtrlHeld })
    };

    document.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'pelican-pause-cb') {
            isManualPaused = !!e.target.checked;
            setConsolePaused(isManualPaused || isCtrlHeld);
        }
    }, true);

    document.addEventListener('click', (e) => {
        const pauseBtn = e.target.closest('#pelican-pause-btn, .pelican-pause-btn');
        if (pauseBtn) {
            e.preventDefault();
            e.stopPropagation();
            toggleManualPause();
            return;
        }

        if (e.target && e.target.id === 'pelican-pause-cb') {
            setTimeout(() => {
                isManualPaused = !!e.target.checked;
                setConsolePaused(isManualPaused || isCtrlHeld);
            }, 0);
            return;
        }

        const pauseToggle = e.target.closest('.pelican-qc-pause-toggle');
        if (pauseToggle && !e.target.closest('#pelican-pause-cb')) {
            const cb = pauseToggle.querySelector('#pelican-pause-cb');
            if (cb) {
                cb.checked = !cb.checked;
                isManualPaused = cb.checked;
                setConsolePaused(isManualPaused || isCtrlHeld);
            }
            return;
        }

        const btn = e.target.closest('.pelican-qc-btn');
        if (!btn) return;

        if (btn.classList.contains('pelican-qc-btn-add')) {
            e.preventDefault();
            e.stopPropagation();
            openCustomCommandsModal();
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        if (btn._sending) return;
        btn._sending = true;
        btn.classList.add('active-pulse');
        setTimeout(() => {
            btn.classList.remove('active-pulse');
            btn._sending = false;
        }, 400);

        const cmd = btn.getAttribute('data-command') || btn.textContent.trim();
        if (!cmd) return;

        // Instant send immediately upon click!
        sendCommand(cmd, true);
    });

    function renderCustomListInModal() {
        const ctn = document.getElementById('pelican-qc-custom-items');
        if (!ctn) return;
        ctn.innerHTML = '';

        const list = getCustomCommands();
        if (list.length === 0) {
            ctn.innerHTML = '<div style="color: #64748b; font-size: 11.5px; text-align: center; padding: 6px;">Пользовательских команд пока нет.</div>';
            return;
        }

        list.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'pelican-qc-custom-item';

            const info = document.createElement('div');
            info.className = 'cmd-info';
            info.innerHTML = `
                <span class="cmd-name">${item.command}</span>
                ${item.alias ? `<span class="cmd-alias">(${item.alias})</span>` : ''}
            `;

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'cmd-del';
            delBtn.innerHTML = '&times;';
            delBtn.title = 'Удалить команду';
            delBtn.addEventListener('click', () => {
                const current = getCustomCommands();
                current.splice(index, 1);
                saveCustomCommands(current);
                renderCustomListInModal();
                rebuildQuickButtons();
            });

            row.appendChild(info);
            row.appendChild(delBtn);
            ctn.appendChild(row);
        });
    }

    function rebuildQuickButtons() {
        const container = document.getElementById('pelican-qc-buttons-ctn');
        if (!container) return;

        container.innerHTML = '';

        const baseList = config.commands || [];
        baseList.forEach(cmd => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pelican-qc-btn';
            btn.setAttribute('data-command', cmd);
            btn.textContent = cmd;
            btn.title = `Отправить: ${cmd}`;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                sendCommand(cmd);
            });
            container.appendChild(btn);
        });

        const customList = getCustomCommands();
        customList.forEach(item => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pelican-qc-btn pelican-qc-btn-custom';
            btn.setAttribute('data-command', item.command);
            btn.textContent = item.alias || item.command;
            btn.title = `Отправить: ${item.command}`;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                sendCommand(item.command);
            });
            container.appendChild(btn);
        });

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'pelican-qc-btn pelican-qc-btn-add';
        addBtn.title = 'Добавить пользовательскую команду';
        addBtn.innerHTML = '+';
        addBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openCustomCommandsModal();
        });
        container.appendChild(addBtn);
    }

    function initQuickCommands() {
        if (!config.quick_commands) return;
        if (document.getElementById('pelican-quick-commands-bar')) return;

        const inputContainer = document.querySelector('div:has(> #send-command)');
        const slot = document.getElementById('pelican-quick-commands-slot');
        if (!inputContainer && !slot) return;

        const bar = document.createElement('div');
        bar.id = 'pelican-quick-commands-bar';

        const btnCtn = document.createElement('div');
        btnCtn.id = 'pelican-qc-buttons-ctn';
        btnCtn.className = 'pelican-qc-buttons';
        btnCtn.addEventListener('click', (e) => {
            const btn = e.target.closest('.pelican-qc-btn');
            if (!btn) return;
            if (btn.classList.contains('pelican-qc-btn-add')) {
                openCustomCommandsModal();
                return;
            }
            const cmd = btn.getAttribute('data-command');
            if (cmd) {
                sendCommand(cmd);
            }
        });
        bar.appendChild(btnCtn);

        const rightArea = document.createElement('div');
        rightArea.className = 'pelican-qc-right';

        const pauseBadge = document.createElement('span');
        pauseBadge.id = 'pelican-pause-badge';
        pauseBadge.className = 'pelican-pause-badge';
        pauseBadge.style.display = 'none';
        rightArea.appendChild(pauseBadge);

        if (config.pause_checkbox || config.pause_on_ctrl) {
            const pauseBtn = document.createElement('button');
            pauseBtn.type = 'button';
            pauseBtn.id = 'pelican-pause-btn';
            pauseBtn.className = 'pelican-qc-btn pelican-pause-btn';
            pauseBtn.innerHTML = `<span class="pause-icon">⏸</span> <span class="pause-text">Заморозить (Ctrl)</span>`;
            pauseBtn.title = 'Заморозить поток консоли (также можно зажать клавишу Ctrl)';
            pauseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                toggleManualPause();
            });
            rightArea.appendChild(pauseBtn);
        }

        if (config.pause_checkbox) {
            const toggleLabel = document.createElement('label');
            toggleLabel.className = 'pelican-qc-pause-toggle';
            toggleLabel.title = 'Приостановить прокрутку консоли (буферизация без потерь)';
            toggleLabel.innerHTML = `
                <input type="checkbox" id="pelican-pause-cb">
                <span class="pause-cb-text">Пауза</span>
            `;
            const cb = toggleLabel.querySelector('input');
            if (cb) {
                cb.addEventListener('change', () => {
                    toggleManualPause();
                });
            }
            rightArea.appendChild(toggleLabel);
        }

        bar.appendChild(rightArea);

        if (slot) {
            slot.appendChild(bar);
        } else if (inputContainer && inputContainer.parentNode) {
            inputContainer.parentNode.insertBefore(bar, inputContainer.nextSibling);
        }

        rebuildQuickButtons();
    }

    // --- 10. COMMAND AUTOCOMPLETE DROPDOWN (TF2 / SOURCE ENGINE STYLE) ---
    const sourceEngineDefaultCommands = [
        // Server Info & Administration
        'status', 'stats', 'version', 'ping', 'users', 'maps *', 'changelevel', 'changelevel2',
        'rcon', 'rcon_password', 'hostname', 'sv_password', 'sv_cheats 0', 'sv_cheats 1',
        'log on', 'log off', 'sv_logecho 1', 'sv_logfile 1', 'sv_visiblemaxplayers',
        'exec server.cfg', 'exec sourcemod.cfg', 'heartbeat', 'quit', 'restart',
        // SourceMod Core Commands
        'sm', 'sm plugins', 'sm plugins list', 'sm plugins load', 'sm plugins unload', 'sm plugins reload',
        'sm exts', 'sm exts list', 'sm exts load', 'sm exts unload',
        'sm_who', 'sm_reloadadmins', 'sm_players', 'sm_admin',
        'sm_kick', 'sm_ban', 'sm_banip', 'sm_unban', 'sm_slap', 'sm_slay', 'sm_mute', 'sm_unmute',
        'sm_gag', 'sm_ungag', 'sm_silence', 'sm_unsilence', 'sm_rename', 'sm_say', 'sm_csay', 'sm_msay',
        'sm_map', 'sm_cvar', 'sm_rcon', 'sm_help', 'sm_version',
        'meta', 'meta list', 'meta version',
        // Gameplay & Team Fortress 2 CVars / Commands
        'mp_restartgame 1', 'mp_timelimit', 'mp_maxrounds', 'mp_winlimit', 'mp_autoteambalance 0',
        'mp_autoteambalance 1', 'mp_scrambleteams', 'mp_friendlyfire 0', 'mp_friendlyfire 1',
        'tf_weapon_criticals 0', 'tf_weapon_criticals 1', 'tf_use_fixed_weaponspreads 1',
        'tf_bot_add', 'tf_bot_kick all', 'tf_mvm_min_players_to_start',
        'tv_status', 'tv_record', 'tv_stoprecord', 'tv_enable 1', 'tv_port',
        // Network & Tickrate Tuning
        'sv_maxrate 0', 'sv_minrate 30000', 'sv_maxupdaterate 66', 'sv_minupdaterate 66',
        'sv_maxcmdrate 66', 'sv_mincmdrate 66', 'sv_client_min_interp_ratio 1',
        'sv_client_max_interp_ratio 2', 'net_status', 'fps_max 0'
    ];

    let acPopupElement = null;
    let acSelectedIndex = -1;
    let acMatches = [];

    function ensureAcPopup() {
        if (!acPopupElement || !acPopupElement.isConnected) {
            let existing = document.getElementById('pelican-ac-popup');
            if (existing) existing.remove();
            acPopupElement = document.createElement('div');
            acPopupElement.id = 'pelican-ac-popup';
            acPopupElement.className = 'pelican-ac-popup';
            document.body.appendChild(acPopupElement);
        }
        return acPopupElement;
    }

    function hideAcPopup() {
        const popup = document.getElementById('pelican-ac-popup');
        if (popup) {
            popup.classList.remove('show');
            popup.innerHTML = '';
        }
        acSelectedIndex = -1;
        acMatches = [];
    }

    function updateAcPopupPosition(input) {
        const popup = ensureAcPopup();
        if (!input) return;
        const container = input.parentElement || input;
        const refRect = container.getBoundingClientRect();
        popup.style.top = `${refRect.bottom + window.scrollY}px`;
        popup.style.bottom = 'auto';
        popup.style.left = `${refRect.left + window.scrollX}px`;
        popup.style.width = `${refRect.width}px`;
    }

    let acOriginalTypedText = '';

    function renderAcMatches(input) {
        const popup = ensureAcPopup();
        popup.innerHTML = '';
        if (acMatches.length === 0) {
            hideAcPopup();
            return;
        }

        acMatches.forEach((item, idx) => {
            const div = document.createElement('div');
            let itemClass = 'pelican-ac-item';
            if (idx === acSelectedIndex) itemClass += ' selected';
            if (item.isTypedEcho) itemClass += ' is-typed-echo';
            div.className = itemClass;

            let badgeHtml = '';
            if (item.isTypedEcho) {
                badgeHtml = '<span class="pelican-ac-badge" style="opacity:0.75;">ввод</span>';
            } else if (item.isHistory) {
                badgeHtml = '<span class="pelican-ac-badge badge-history">история</span>';
            }

            div.innerHTML = `<span class="pelican-ac-cmd">${item.command}</span>${badgeHtml}`;

            div.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fillCommand(item.command);
                hideAcPopup();
            });

            popup.appendChild(div);
        });

        updateAcPopupPosition(input);
        popup.classList.add('show');
    }

    function getCombinedAcCommands() {
        const historyList = getCommandHistory();
        const customQc = getCustomCommands().map(c => c.command);
        const cfgCommands = (config && Array.isArray(config.commands)) ? config.commands : [];

        const historyItems = historyList.map(cmd => ({ command: cmd, isHistory: true }));
        const historyCmdSet = new Set(historyList.map(c => c.toLowerCase()));

        const standardCmds = Array.from(new Set([
            ...customQc,
            ...cfgCommands,
            ...sourceEngineDefaultCommands
        ]))
        .filter(c => !historyCmdSet.has(c.toLowerCase()))
        .map(cmd => ({ command: cmd, isHistory: false }));

        return [...historyItems, ...standardCmds];
    }

    function handleAcInputEvent(e) {
        const input = e.target;
        if (!input || input.id !== 'send-command') return;
        if (!config.autocomplete) return;

        const val = input.value.trim().toLowerCase();
        acOriginalTypedText = input.value;
        if (!val || val.length === 0) {
            hideAcPopup();
            return;
        }

        const allCandidates = getCombinedAcCommands();
        const seen = new Set();
        acMatches = [];

        // 1. First item: exactly what user is typing (TF2 console style top candidate)
        acMatches.push({
            command: input.value.trim(),
            isTypedEcho: true,
            isHistory: false
        });
        seen.add(val);

        // 2. Best matching candidates
        for (const item of allCandidates) {
            const lower = item.command.toLowerCase();
            if (lower.startsWith(val) && !seen.has(lower)) {
                seen.add(lower);
                acMatches.push(item);
                if (acMatches.length >= 14) break;
            }
        }

        // If only the typed echo was found with no actual suggestions, hide popup
        if (acMatches.length === 1) {
            hideAcPopup();
            return;
        }

        acSelectedIndex = 0;
        renderAcMatches(input);
    }

    function handleAcKeydownEvent(e) {
        const input = e.target;
        if (!input || input.id !== 'send-command') return;
        const popup = document.getElementById('pelican-ac-popup');
        if (!popup || !popup.classList.contains('show') || acMatches.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            acSelectedIndex = (acSelectedIndex + 1) % acMatches.length;
            renderAcMatches(input);
            // Substitute into input field live as user scrolls through suggestions
            if (acMatches[acSelectedIndex]) {
                input.value = acMatches[acSelectedIndex].command;
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            acSelectedIndex = (acSelectedIndex - 1 + acMatches.length) % acMatches.length;
            renderAcMatches(input);
            if (acMatches[acSelectedIndex]) {
                input.value = acMatches[acSelectedIndex].command;
            }
        } else if (e.key === 'Tab' || (e.key === 'Enter' && acSelectedIndex >= 0)) {
            if (acMatches[acSelectedIndex]) {
                e.preventDefault();
                e.stopPropagation();
                fillCommand(acMatches[acSelectedIndex].command);
                hideAcPopup();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            if (acOriginalTypedText) input.value = acOriginalTypedText;
            hideAcPopup();
        }
    }

    function initAutocomplete() {
        if (!config.autocomplete) return;
        ensureAcPopup();

        // Attach global delegated listeners ONCE so Livewire morphing never breaks them
        if (!window._pelicanAcDelegated) {
            window._pelicanAcDelegated = true;

            document.addEventListener('input', (e) => {
                if (e.target && e.target.id === 'send-command') {
                    handleAcInputEvent(e);
                }
            }, true);

            document.addEventListener('keydown', (e) => {
                if (e.target && e.target.id === 'send-command') {
                    handleAcKeydownEvent(e);
                }
            }, true);

            document.addEventListener('blur', (e) => {
                if (e.target && e.target.id === 'send-command') {
                    setTimeout(hideAcPopup, 200);
                }
            }, true);

            window.addEventListener('resize', () => {
                const input = document.getElementById('send-command');
                if (input && acMatches.length > 0) updateAcPopupPosition(input);
            });

            window.addEventListener('scroll', () => {
                const input = document.getElementById('send-command');
                if (input && acMatches.length > 0) updateAcPopupPosition(input);
            }, true);
        }

        // Also track Enter key on #send-command to capture commands into history
        const input = document.getElementById('send-command');
        if (input && !input._historyKeyInit) {
            input._historyKeyInit = true;
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const cmd = input.value.trim();
                    if (cmd) addCommandToHistory(cmd);
                }
            });
        }
    }

    // --- 11. WEBSOCKET TELEMETRY BRIDGE ---
    try {
        const origWS = window.WebSocket;
        if (origWS && !origWS._pelicanProIntercepted) {
            class PelicanWebSocket extends origWS {
                constructor(...args) {
                    super(...args);
                    window._pelicanConsoleSocket = this;
                    this.addEventListener('message', (e) => {
                        try {
                            const msg = JSON.parse(e.data);
                            if (msg && msg.event === 'stats' && msg.args && msg.args[0]) {
                                const raw = msg.args[0];
                                const statsObj = typeof raw === 'string' ? JSON.parse(raw) : raw;
                                window.dispatchEvent(new CustomEvent('pelican:server-stats', { detail: statsObj }));
                            }
                        } catch (err) {}
                    });
                }
                send(data) {
                    if (typeof data === 'string' && data.indexOf('"send logs"') !== -1) {
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed && parsed.event === 'send logs') {
                                if (this._hasRequestedLogs) {
                                    return;
                                }
                                const term = window._pelicanTerminal;
                                if (term && term.buffer && term.buffer.active && term.buffer.active.baseY > 10) {
                                    this._hasRequestedLogs = true;
                                    return;
                                }
                                this._hasRequestedLogs = true;
                            }
                        } catch (e) {}
                    }
                    return super.send(data);
                }
            }
            PelicanWebSocket._pelicanProIntercepted = true;
            window.WebSocket = PelicanWebSocket;
        }
    } catch (e) {}

    function attachLivewireSafety() {
        if (!window.Livewire || window._pelicanLivewireSafetyAttached) return;
        window._pelicanLivewireSafetyAttached = true;

        try {
            window.Livewire.hook('morph.updating', ({ el }) => {
                if (el.id === 'terminal' || el.classList.contains('xterm') || el.closest('#terminal')) {
                    return false;
                }
            });
            window.Livewire.hook('morph.updated', () => {
                ensureTerminalAttached();
                initInteractiveScrollbar();
                initQuickCommands();
                initAutocomplete();
            });
        } catch (e) {}
    }

    if (window.Livewire) {
        attachLivewireSafety();
    } else {
        document.addEventListener('livewire:init', attachLivewireSafety);
    }

    function initAll() {
        hookGlobalXterm();
        initKeyboardHooks();
        initQuickCommands();
        initCopyOnSelect();
        initAutocomplete();
        initInteractiveScrollbar();
        ensureTerminalAttached();

        const term = window._pelicanTerminal || (document.getElementById('terminal')?._xterm);
        if (term) {
            patchTerminalInstance(term);
            syncSliderFromBuffer(term);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }

    const observer = new MutationObserver(() => {
        ensureTerminalAttached();
        if (!document.getElementById('pelican-quick-commands-bar')) {
            initQuickCommands();
        }
        initAutocomplete();
        initInteractiveScrollbar();
        const term = window._pelicanTerminal || (document.getElementById('terminal')?._xterm);
        if (term && !term._proPatched) {
            patchTerminalInstance(term);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(() => {
        ensureTerminalAttached();
        initInteractiveScrollbar();
        const term = window._pelicanTerminal;
        if (term) syncSliderFromBuffer(term);
    }, 300);
})();
