<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";

    type Props = {
        timeoutMs?: number;
        warningMs?: number;
        redirectTo?: string;
        onTimeout?: () => void | Promise<void>;
    };

    let {
        timeoutMs = 60 * 60 * 1000, 
        warningMs = 60 * 1000, 
        redirectTo = '/login', 
        onTimeout
    }: Props = $props();

    const STORAGE_KEY = 'bme:last-activity';
    const THROTTLE_MS = 1000;
    const ACTIVITY_EVENTS = [
        'mousemove', 
        'mousedown', 
        'keydown', 
        'scroll', 
        'wheel', 
        'touchstart'
    ] as const;

    let showWarning = $state(false);
    let secondsLeft = $state(0);
    let lastWrite = 0;
    let loggingOut = false;
    let ticker: ReturnType<typeof setInterval> | undefined;

    function nowMs(): number {
        return Date.now();
    }

    function readLastActivity(): number {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? Number.parseInt(raw, 10) : NaN;
            return Number.isFinite(parsed) ? parsed : nowMs();
        } catch {
            return nowMs();
        }
    }

    function writeLastActivity(ts: number): void {
        try {
            localStorage.setItem(STORAGE_KEY, String(ts));
        } catch {
            /* storage unavailable (e.g. private mode) - degrade silently */
        }
    }

    function recordActivity(force = false): void {
        const t = nowMs();
        if (!force && t - lastWrite < THROTTLE_MS) return;
        lastWrite = t;
        writeLastActivity(t);
    }

    const handleActivity = () => recordActivity();

    async function logout(): Promise<void> {
        if (loggingOut) return;
        loggingOut = true;
        if (ticker) clearInterval(ticker);

        try {
            await onTimeout?.();
        } catch (err) {
            console.error('Session timeout logout failed: ', err);
        } finally {
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch {
                /* ignore */
            }
            await goto(`${redirectTo}?reason=timeout`, { replaceState: true });
        }
    }

    function tick(): void {
        const idleMs = nowMs() - readLastActivity();
        const remainingMs = timeoutMs - idleMs;

        if (remainingMs <= 0) {
            logout();
            return;
        }

        if (remainingMs <= warningMs) {
            showWarning = true;
            secondsLeft = Math.ceil(remainingMs / 1000);
        } else if (showWarning) {
            showWarning = false;
        }
    }

    function stayLoggedIn(): void {
        recordActivity(true);
        showWarning = false;
        secondsLeft = Math.ceil(warningMs / 1000);
    }

    function onVisibilityChange(): void {
        if (document.visibilityState === 'visible') tick();
    }

    onMount(() => {
        recordActivity(true);

        for (const evt of ACTIVITY_EVENTS) {
            window.addEventListener(evt, handleActivity, { passive: true });
        }
        document.addEventListener('visibilitychange', onVisibilityChange);
        ticker = setInterval(tick, 1000);

        return () => {
            for (const evt of ACTIVITY_EVENTS) { 
                window.removeEventListener(evt, handleActivity);
            }
            document.removeEventListener('visibilitychange', onVisibilityChange);
            if (ticker) clearInterval(ticker);
        };
    });
</script>

{#if showWarning}
    <div class="st-overlay" role="dialog" aria-modal="true" aria-labelledby="st-title">
        <div class="st-card">
            <h2 id="st-title" class="st-title">Still there?</h2>
            <p class="st-body">
                You&rsquo;ve been inactive for a while. For your security you&rsquo;ll be signed out in <strong>{secondsLeft}</strong> second{secondsLeft === 1 ? '': 's'}.
            </p>
            <div class="st-actions">
                <button type="button" class="st-btn st-btn--ghost" onclick={logout}>Sign out now</button>
                <button type="button" class="st-btn st-btn--primary" onclick={stayLoggedIn}>Stay signed in</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .st-overlay {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: grid;
        place-items: center;
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(2px);
        padding: 1rem;
    }

    .st-card {
        width: min(420px, 100%);
        background-color: var(--bme-surface);
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
        border-top: 4px solid var(--bme-dark-blue, #6cb33f);
    }

    .st-title {
        margin: 0 0 0.5rem;
        color: var(--bme-dark-blue, #004b8d);
        font-size: 1.25rem;
        font-weight: 700;
    }

    .st-body {
        margin: 0 0 1.25rem;
        color: var(--bme-ink);
        line-height: 1.5;
    }

    .st-body strong {
        color: var(--bme-dark-blue, #004b8d);
    }

    .st-actions {
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
    }

    .st-btn {
        appearance: none;
        border: none;
        border-radius: 8px;
        padding: 0.6rem 1.1rem;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.3s ease, background 0.3s ease;
    }

    .st-btn--ghost {
        background: transparent;
        color: var(--bme-dark-blue, #004b8d);
        border: 1px solid var(--bme-border);
    }

    .st-btn--ghost:hover {
        background: var(--bme-hover);
    }

    .st-btn--primary {
        background: var(--bme-dark-blue, #6cb33f);
        color: #ffffff;
    }

    .st-btn--primary:hover {
        opacity: 0.9;
    }
</style>