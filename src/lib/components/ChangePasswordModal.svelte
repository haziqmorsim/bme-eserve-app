<script lang="ts">
    import { applyAction, enhance } from "$app/forms";
    import { invalid, type SubmitFunction } from "@sveltejs/kit";
    import { Check, KeyRound, X } from "@lucide/svelte";
    import { fade, scale } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { addToast } from "$lib/stores/toast";
    import { PASSWORD_RULES, passwordChecks } from "$lib/password";

    type Field = 'current' | 'next' | 'confirm';

    let { open = $bindable(false) } = $props<{ open?: boolean }>();

    let current = $state('');
    let next = $state('');
    let confirm = $state('');
    let busy = $state(false);
    let err = $state('');
    let errField = $state<Field | null>(null);

    let checks = $derived(passwordChecks(next));
    let allValid = $derived(checks.length && checks.upper && checks.number && checks.symbol);
    let match = $derived(confirm.length > 0 && next === confirm);

    function clear() {
        current = '';
        next = '';
        confirm = '';
        err = '';
        errField = null;
    }

    function clearError() {
        err = '';
        errField = null;
    }

    function close() {
        if (busy) return;
        open = false;
        clear();
    }

    function onKey(e: KeyboardEvent) {
        if (open && e.key === 'Escape') close();
    }

    function focusFirst(node: HTMLInputElement) {
        node.focus();
    }

    function fail(field: Field, message: string) {
        errField = field;
        err = message;
    }

    const submit: SubmitFunction = ({ cancel }) => {
        err = '';
        errField = null;
        if (!current) {
            fail('current', 'Enter your current password.');
            return cancel();
        }
        if (!allValid) {
            fail('next', 'Please meet all the password requirements below.');
            return cancel();
        }
        if (!match) {
            fail('confirm', 'The passwords do not match.');
            return cancel();
        }

        busy = true;
        return async ({ result }) => {
            busy = false;
            if (result.type === 'success') {
                open = false;
                clear();
                addToast('Password updated successfully');
            } else if (result.type === 'failure') {
                const data = result.data as { field?: Field; error?: string } | undefined;
                fail(data?.field ?? 'current', data?.error ?? 'Could not update your password. Please try again.');
                if (data?.field === 'current') current = '';
            } else if (result.type == 'redirect') {
                await applyAction(result);
            } else {
                err = 'Could not update your password. Please try again.';
            }
        };
    };
</script>

<svelte:window onkeydown={onKey} />

{#if open}
    <div class="modal-overlay" role="presentation" transition:fade={{ duration: 150 }}>
        <div class="modal-panel pw-panel" role="dialog" aria-modal="true" aria-labelledby="pw-title" tabindex="-1" transition:scale={{ duration: 200, start: 0.94, easing: cubicOut }}>
            <div class="modal-head">
                <h3 id="pw-title"><KeyRound size={17} class="pw-icon" /> Change Password</h3>
                <button type="button" class="modal-x" onclick={close} disabled={busy} aria-label="Close">✕</button>
            </div>

            <form action="?/changePassword" method="POST" use:enhance={submit} oninput={clearError} novalidate>
                <div class="modal-body pw-body">
                    <label>
                        <span>Current Password <span class="required">*</span></span>
                        <input type="password" name="current" bind:value={current} autocomplete="current-password" class:invalid={errField === 'current'} use:focusFirst />
                    </label>
                    <label>
                        <span>New Password <span class="required">*</span></span>
                        <input type="password" name="next" bind:value={next} autocomplete="new-password" class:invalid={errField === 'next'} />
                    </label>
                    <label>
                        <span>Confirm New Password <span class="required">*</span></span>
                        <input type="password" name="confirm" bind:value={confirm} autocomplete="new-password" class:invalid={errField === 'confirm'} />
                    </label>

                    <ul class="rules">
                        {#each PASSWORD_RULES as rule (rule.key)}
                            <li class:ok={checks[rule.key]}>
                                <span class="ic">{#if checks[rule.key]}<Check size={15} />{:else}<X size={15} />{/if}</span>
                                {rule.label}
                            </li>
                        {/each}
                        <li class:ok={match} class:muted={confirm.length === 0}>
                            <span class="ic">{#if match}<Check size={15} />{:else}<X size={15} />{/if}</span>
                            Password match
                        </li>
                    </ul>

                    {#if err}<p class="err" role="alert">{err}</p>{/if}
                </div>

                <div class="modal-actions pw-actions">
                    <button type="button" class="btn-ghost" onclick={close} disabled={busy}>Cancel</button>
                    <button type="submit" class="btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
                </div>
            </form>
        </div>
    </div>
{/if}

<style>
    .pw-panel {
        max-width: 440px;
    }
 
    .modal-head h3 {
        display: flex;
        align-items: center;
        gap: 8px;
    }
 
    :global(.pw-icon) {
        color: var(--bme-dark-blue);
    }
 
    form {
        display: flex;
        flex-direction: column;
        min-height: 0;
    }
 
    .pw-body {
        padding: 20px 20px 4px;
        flex: 1 1 auto;
    }
 
    label {
        display: block;
        margin-bottom: 14px;
    }
 
    label > span {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: var(--bme-ink);
    }
 
    label input {
        margin-top: 6px;
    }
 
    input.invalid {
        border-color: var(--bme-red);
    }
 
    .rules {
        list-style: none;
        margin: 4px 0 14px;
        padding: 14px 16px;
        background: var(--bme-light-grey);
        border: 1px solid var(--bme-border);
        border-radius: 10px;
        font-size: 13px;
    }
 
    .rules li {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--bme-red);
        margin-bottom: 6px;
    }
 
    .rules li:last-child {
        margin-bottom: 0;
    }
 
    .rules li.ok {
        color: var(--bme-green);
    }
 
    .rules li.muted {
        color: var(--bme-muted);
    }
 
    .rules .ic {
        display: inline-flex;
        flex-shrink: 0;
    }
 
    .err {
        color: var(--bme-red);
        font-size: 14px;
        margin: 0 0 10px;
    }
 
    .pw-actions {
        padding: 12px 20px 20px;
    }
</style>