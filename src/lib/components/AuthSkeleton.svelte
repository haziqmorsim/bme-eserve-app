<script lang="ts">
    import AuthBrandPanel from "./AuthBrandPanel.svelte";
	import ThemeToggle from "./ThemeToggle.svelte";

    type AuthSkeletonVariant = 
        | 'login'
        | 'forgot'
        | 'enquiry'
        | 'confirmation'
        | 'change'
        | 'reset'
        | 'maintenance';

    let { variant }: { variant: AuthSkeletonVariant } = $props();

    const n = (count: number) => Array.from({ length: count }, (_, i) => i);
</script>

{#snippet bar(w: string)}<span class="t" style:width={w}>&nbsp;</span>{/snippet}

{#snippet field(labelWidth: string)}
    <label>
        <span>{@render bar(labelWidth)}</span>
        <input class="sk-in" disabled tabindex="-1" aria-hidden="true" />
    </label>
{/snippet}

{#snippet themeToggle()}
    <div class="sk toggle"></div>
{/snippet}

{#snippet backLink(width: string)}
    <p class="back">{@render bar(width)}</p>
{/snippet}

{#snippet rules()}
    <ul class="rules">
        {#each [60, 72, 52, 62, 44] as w (w)}
            <li><span class="sk ic"></span>{@render bar(`${w}%`)}</li>
        {/each}
    </ul>
{/snippet}

{#if variant === 'maintenance'}
    <div class="skw" role="status" aria-live="polite" aria-label="Loading">
        <div class="maint-wrap">
            <div class="card maint-card">
                <h1>{@render bar('70%')}</h1>
                <p class="maint-msg">{@render bar('90%')}<br class="m-only" /><span class="m-only">{@render bar('50%')}</span></p>
                <p class="maint-contact">{@render bar('55%')}</p>
                <div class="sk maint-btn"></div>
            </div>
        </div>
    </div>
{:else}
    <div class="skw" role="status" aria-live="polite" aria-label="Loading">
        <div class="shell">
            <AuthBrandPanel />

            <main class="pane">
                <div class="card panel" class:wide={variant === 'enquiry'} class:centered={variant === 'confirmation'}>
                    {#if variant === 'login'}
                        <div class="head">
                            <h2>{@render bar('44%')}</h2>
                            {@render themeToggle()}
                        </div>
                        <p class="sub">{@render bar('96%')}<br />{@render bar('30%')}</p>
                        {@render field('18%')}
                        {@render field('24%')}
                        <div class="forgot">{@render bar('24%')}</div>
                        <button type="button" class="sk submit" disabled tabindex="-1" aria-hidden="true">&nbsp;</button>

                        <div class="foot">
                            <p class="note">{@render bar('86%')}<br />{@render bar('62%')}</p>
                            <p class="enquiry">{@render bar('68%')}</p>
                        </div>
                    {:else if variant === 'forgot'}
                        <div class="head">
                            <h2>{@render bar('72%')}</h2>
                            {@render themeToggle()}
                        </div>
                        <p class="sub">{@render bar('96%')}<br />{@render bar('58%')}</p>

                        {@render field('18%')}
                        <button type="button" class="sk submit sm-top" disabled tabindex="-1" aria-hidden="true">&nbsp;</button>
                        {@render backLink('34%')}
                    {:else if variant === 'enquiry'}
                        <div class="head">
                            <h2>{@render bar('72%')}</h2>
                            {@render themeToggle()}
                        </div>
                        <p class="sub">{@render bar('96%')}<br />{@render bar('40%')}</p>

                        {@render field('16%')}
                        {@render field('34%')}
                        {@render field('26%')}
                        <label>
                            <span>{@render bar('22%')}</span>
                            <textarea class="sk-in" rows="5" disabled tabindex="-1" aria-hidden="true"></textarea>
                        </label>
                        <button type="button" class="sk submit sm-top" disabled tabindex="-1" aria-hidden="true">&nbsp;</button>
                        {@render backLink('28%')}
                    {:else if variant === 'confirmation'}
                        <div class="check"><div class="sk check-ic"></div></div>
                        <h2>{@render bar('56%')}</h2>
                        <p class="msg">{@render bar('100%')}<br />{@render bar('92%')}<br class="m-only" /><span class="m-only">{@render bar('40%')}</span></p>
                        <button type="button" class="sk submit sm-top" disabled tabindex="-1" aria-hidden="true">&nbsp;</button>
                    {:else if variant === 'change'}
                        <h2>{@render bar('64%')}</h2>
                        <p class="sub">{@render bar('100%')}<br />{@render bar('58%')}</p>

                        {@render field('36%')}
                        {@render field('40%')}
                        {@render rules()}
                        <button type="button" class="sk submit sm-top" disabled tabindex="-1" aria-hidden="true">&nbsp;</button>
                        <div class="back-form"><button type="button" class="link-btn sk" disabled tabindex="-1" aria-hidden="true">&nbsp;</button></div>
                    {:else}
                        <h2>{@render bar('58%')}</h2>
                        <p class="sub">{@render bar('84%')}</p>

                        {@render field('36%')}
                        {@render field('40%')}
                        {@render rules()}
                        <button type="button" class="sk submit sm-top" disabled tabindex="-1" aria-hidden="true">&nbsp;</button>
                    {/if}
                </div>
            </main>
        </div>
    </div>
{/if}

<style>
    .sk,
    .t {
        border-radius: 8px;
        background: linear-gradient(90deg, #dde3ea 25%, #eef2f6 37%, #dde3ea 63%);
        background-size: 400% 100%;
        animation: skShimmer 1.3s ease infinite;
    }

    :global(:root[data-theme='dark']) .sk,
    :global(:root[data-theme='dark']) .t {
        background: linear-gradient(90deg, #26374b 25%, #3a556f 37%, #26374b 63%);
        background-size: 400% 100%;
    }

    .t {
        display: inline-block;
        vertical-align: top;
        max-width: 100%;
        border-radius: 5px;
        color: transparent;
        user-select: none;
    }

    .shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: minmax(340px, 5fr) 7fr;
        background: var(--bme-page-bg);
    }

    .pane {
        display: grid;
        place-items: center;
        padding: 32px 24px;
    }

    .panel {
        width: 100%;
        max-width: 440px;
        padding: 34px 36px 28px;
        border-radius: 16px;
    }

    .panel.wide {
        max-width: 480px;
    }

    .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    h2 {
        margin: 0;
        font-size: 26px;
        line-height: 1.2;
    }

    .head h2 {
        flex: 1;
        min-width: 0;
    }

    .toggle {
        flex: 0 0 auto;
        width: 77px;
        height: 28px;
        border-radius: 8px;
    }

    .sub {
        margin: 6px 0 24px;
        font-size: 14px;
    }

    label {
        display: block;
        margin-bottom: 16px;
    }

    label > span:first-child {
        display: block;
        font-size: 13px;
        font-weight: 700;
        margin-bottom: 6px;
    }

    input {
        height: 44px;
    }

    textarea {
        resize: none;
        min-height: 110px;
    }

    .sk-in {
        background: linear-gradient(90deg, #dde3ea 25%, #eef2f6 37%, #dde3ea 63%);
        background-size: 400% 100%;
        animation: skShimmer 1.3s ease infinite;
        border-color: transparent;
        opacity: 1;
    }

    :global(:root[data-theme='dark']) .sk-in {
        background: linear-gradient(90deg, #26374b 25%, #3a556f 37%, #26374b 63%);
        background-size: 400% 100%;
    }

    .forgot {
        text-align: right;
        margin: -8px 0 18px;
    }

    .forgot :global(.t) {
        font-size: 13px;
    }

    .submit {
        width: 100%;
        height: 46px;
        padding: 0;
        border: 0;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 700;
        color: transparent;
    }

    .submit.sm-top {
        margin-top: 6px;
    }

    .foot {
        margin-top: 22px;
        padding-top: 16px;
        border-top: 1px solid var(--bme-border);
    }

    .note {
        margin: 0;
        font-size: 13px;
        text-align: center;
    }

    .enquiry {
        margin: 8px 0 0;
        font-size: 13px;
        text-align: center;
    }

    .back {
        margin: 22px 0 0;
        padding-top: 16px;
        border-top: 1px solid var(--bme-border);
        font-size: 13px;
        text-align: center;
    }

    .back-form {
        margin: 22px 0 0;
        padding-top: 16px;
        border-top: 1px solid var(--bme-border);
        text-align: center;
    }

    .link-btn {
        width: 30%;
        padding: 0;
        border: none;
        font: inherit;
        font-size: 13px;
        font-weight: 600;
        color: transparent;
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
        margin-bottom: 6px;
    }

    .rules li:last-child {
        margin-bottom: 0;
    }

    .ic {
        display: inline-flex;
        flex-shrink: 0;
        width: 15px;
        height: 15px;
        border-radius: 50%;
    }

    .panel.centered {
        text-align: center;
    }

    @media (min-width: 481px) {
        .panel.centered {
            padding-top: 40px;
            padding-bottom: 36px;
        }
    }

    .check {
        display: inline-flex;
        margin-bottom: 10px;
    }

    .check-ic {
        width: 52px;
        height: 52px;
        border-radius: 50%;
    }

    .msg {
        margin: 10px 0 26px;
        font-size: 15px;
        line-height: 1.6;
    }

    .m-only {
        display: none;
    }

    .maint-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 20px;
    }

    .maint-card {
        max-width: 560px;
        width: 100%;
        padding: 32px;
        text-align: center;
    }

    .maint-card h1 {
        margin-top: 0;
    }

    .maint-msg {
        white-space: pre-line;
    }

    .maint-contact {
        font-size: 13.5px;
    }

    .maint-btn {
        display: inline-block;
        vertical-align: top;
        width: 106px;
        height: 40px;
        margin-top: 8px;
    }

    .skw {
        animation: skFade 160ms ease both;
    }

    @keyframes skShimmer {
        0% { background-position: 100% 0; }
        100% { background-position: -100% 0; }
    }

    @keyframes skFade {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    @media (max-width: 860px) {
        .shell {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr;
        }

        .pane {
            align-items: start;
            padding: 20px 16px 28px;
        }
    }

    @media (max-width: 480px) {
        .panel {
            padding: 26px 20px 22px;
        }

        .m-only {
            display: inline;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .sk,
        .t {
            animation-duration: 2.4s;
        }
    }
</style>