<script lang="ts">
    import type { GrateDef, ResolvedSection } from "$lib/boiler-design";
    import { sectionTelemetry } from "$lib/boiler-design";

    let {
        def, 
        sections, 
        mode = 'dashboard', 
        boilerCode = '', 
        activeKey = null, 
        onselect
    } = $props<{
        def: GrateDef;
        sections: ResolvedSection[];
        mode?: 'dashboard' | 'parts';
        boilerCode?: string;
        activeKey?: string | null;
        onselect?: (componentId: string, key: string) => void;
    }>();

    let open = $state<string | null>(null);
    let tip = $state<{ key: string; left: number; top: number; placement: 'above' | 'below' } | null>(null);
    let tipEl = $state<HTMLDivElement>();

    const telemetry = $derived(
        Object.fromEntries(
            sections.map((s: ResolvedSection) => [s.key, sectionTelemetry(boilerCode, s.key)])
        )
    );

    function clickable(s: ResolvedSection) {
        return mode === 'parts' && !!s.componentId;
    }

    const TIP_MARGIN = 10;
    const TIP_EST_WIDTH = 210;
    const TIP_EST_HEIGHT = 140;

    function openTip(s: ResolvedSection, btn: HTMLElement) {
        open = s.key;
        const r = btn.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let left = r.left + r.width / 2;
        left = Math.min(vw - TIP_MARGIN - TIP_EST_WIDTH / 2, Math.max(TIP_MARGIN + TIP_EST_WIDTH / 2, left));

        const spaceAbove = r.top;
        const placement: 'above' | 'below' = spaceAbove >= TIP_EST_HEIGHT + TIP_MARGIN ? 'above' : 'below';
        const top = placement === 'above' ? r.top - 8 : r.bottom + 8;

        tip = { key: s.key, left, top: Math.max(TIP_MARGIN, Math.min(vh - TIP_MARGIN, top)), placement };
    }

    function closeTip() {
        open = null;
        tip = null;
    }

    function handleClick(s: ResolvedSection, e: MouseEvent) {
        if (mode === 'parts') {
            if (s.componentId) onselect?.(s.componentId, s.key);
        } else if (open === s.key) {
            closeTip();
        } else {
            openTip(s, e.currentTarget as HTMLElement);
        }
    }

    function onHotEnter(s: ResolvedSection, e: PointerEvent) {
        if (e.pointerType === 'mouse') openTip(s, e.currentTarget as HTMLElement);
    }
    function onHotLeave(s: ResolvedSection, e: PointerEvent) {
        if (e.pointerType === 'mouse' && open === s.key) closeTip();
    }
    function onHotFocus(s: ResolvedSection, e: FocusEvent) {
        openTip(s, e.currentTarget as HTMLElement);
    }

    function onWindowClick(e: MouseEvent) {
        if (mode !== 'dashboard' || open === null) return;
        const target = e.target as HTMLElement;
        if (target.closest?.('.hot') || target.closest?.('.tip')) return;
        closeTip();
    }

    function onWindowScrollOrResize() {
        if (open !== null) closeTip();
    }

    $effect(() => {
        if (!tip || !tipEl) return;
        const el = tipEl;
        const t = tip;
        requestAnimationFrame(() => {
            if (open !== t.key) return;
            const r = el.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            let { left, top, placement } = t;

            const halfW = r.width / 2;
            if (left + halfW > vw - TIP_MARGIN) left = vw - TIP_MARGIN - halfW;
            if (left - halfW < TIP_MARGIN) left = TIP_MARGIN + halfW;

            const height = r.height;
            if (placement === 'above' && top - height < TIP_MARGIN) {
                placement = 'below';
                top = top + 8 + height;
            } else if (placement === 'below' && top + height > vh - TIP_MARGIN) {
                top = Math.max(TIP_MARGIN, vh - TIP_MARGIN - height);
            }

            if (left !== t.left || top !== t.top || placement !== t.placement) {
                tip = { ...t, left, top, placement };
            }
        });
    });
</script>

<svelte:window onclick={onWindowClick} onscroll={onWindowScrollOrResize} onresize={onWindowScrollOrResize} />

<div class="bd" class:wide={mode === 'parts'}>
    <div class="stage" class:parts={mode === 'parts'}>
        <img src={def.img} alt={`${def.label} boiler schematic`} draggable="false" />

        {#each sections as s (s.key)}
            <button 
            type="button" 
            class="hot" 
            class:dim={mode === 'parts' && !s.componentId} 
            class:active={mode === 'parts' && activeKey === s.key} 
            class:hovered={open === s.key} 
            class:can-click={clickable(s)} 
            style={`left:${s.rect.l}%;top:${s.rect.t}%;width:${s.rect.w}%;height:${s.rect.h}%;`} 
            aria-label={s.label} 
            aria-pressed={mode === 'parts' ? activeKey === s.key : undefined} 
            onpointerenter={(e) => onHotEnter(s, e)} 
            onpointerleave={(e) => onHotLeave(s, e)} 
            onfocus={(e) => onHotFocus(s, e)} 
            onclick={(e) => handleClick(s, e)}
            >
                <span class="dot"></span>
                <span class="tag">{s.label}</span>
            </button>
        {/each}

        {#if mode === 'dashboard' && open && tip}
            <div class="tip {tip.placement}" style={`left:${tip.left}px; top:${tip.top}px;`} bind:this={tipEl} role="tooltip">
                <div class="tip-head">
                    <span class="tip-title">{sections.find((s: ResolvedSection) => s.key === open)?.label}</span>
                    <span class="badge {telemetry[open].state.toLowerCase()}">{telemetry[open].state}</span>
                </div>
                <dl class="tip-metrics">
                    {#each telemetry[open].metrics as m}
                        <div class="row"><dt>{m.label}</dt><dd>{m.value}</dd></div>
                    {/each}
                </dl>
            </div>
        {/if}
    </div>

    <div class="caption">
        <span class="type">{def.label}</span>
        <span class="tagline">{def.tagline}</span>
    </div>
</div>

<style>
    .bd {
        width: 70%;
        margin: 0 auto;
		--ink: var(--bme-ink, #1b2733);
		--muted: var(--bme-muted, #6b7a8d);
		--border: var(--bme-border, #e2e8ef);
		--blue: var(--bme-dark-blue, #10456e);
		--blue-d: var(--bme-darker-blue, #0c3358);
	}

	.bd.wide {
		width: 100%;
		margin: 0;
	}

	.stage {
		position: relative;
		width: 100%;
		border-radius: 12px;
		overflow: visible;
		user-select: none;
	}

	.stage img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 12px;
		border: 1px solid var(--border);
		background: #fff;
	}

	.hot {
		position: absolute;
		margin: 0;
		padding: 0;
		border: 1.5px solid transparent;
		border-radius: 8px;
		background: transparent;
		cursor: default;
		transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
	}

	.hot .dot {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 12px;
		height: 12px;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		background: var(--blue);
		box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.85), 0 1px 4px rgba(0, 0, 0, 0.3);
		opacity: 0.55;
		transition: transform 160ms ease, opacity 160ms ease, background 160ms ease;
	}

	.hot .tag {
		position: absolute;
		left: 50%;
		bottom: calc(100% + 6px);
		transform: translateX(-50%) translateY(4px);
		white-space: nowrap;
		font-size: 11px;
		font-weight: 700;
		color: #fff;
		background: var(--blue-d);
		padding: 3px 8px;
		border-radius: 999px;
		opacity: 0;
		pointer-events: none;
		transition: opacity 140ms ease, transform 140ms ease;
	}

	.hot:hover,
	.hot:focus-visible,
	.hot.hovered {
		background: rgba(16, 69, 110, 0.1);
		border-color: rgba(16, 69, 110, 0.55);
		outline: none;
	}

	.hot:hover .dot,
	.hot:focus-visible .dot,
	.hot.hovered .dot {
		opacity: 1;
		transform: translate(-50%, -50%) scale(1.25);
	}

	.hot:hover .tag,
	.hot:focus-visible .tag,
	.hot.hovered .tag {
		opacity: 1;
		transform: translateX(-50%) translateY(0);
	}

	.stage.parts .hot.can-click {
		cursor: pointer;
	}

	.hot.can-click .dot {
		opacity: 0.8;
	}
	.hot.dim {
		cursor: not-allowed;
	}

	.hot.dim .dot {
		background: var(--muted);
		opacity: 0.35;
	}

	.hot.dim .tag {
		background: var(--muted);
	}

	.hot.active {
		background: rgba(16, 69, 110, 0.16);
		border-color: var(--blue);
		box-shadow: 0 0 0 3px rgba(16, 69, 110, 0.18);
		animation: pulse 1.6s ease-in-out infinite;
	}

	.hot.active .dot {
		opacity: 1;
		background: var(--blue-d);
		transform: translate(-50%, -50%) scale(1.3);
	}

	@keyframes pulse {
		0%,
		100% {
			box-shadow: 0 0 0 3px rgba(16, 69, 110, 0.16);
		}
		50% {
			box-shadow: 0 0 0 7px rgba(16, 69, 110, 0.06);
		}
	}

	.tip {
		position: fixed;
		z-index: 1000;
		transform: translateX(-50%);
		min-width: 168px;
		max-width: 230px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow: 0 10px 30px rgba(12, 51, 88, 0.18);
		padding: 10px 12px;
		animation: tip-in 140ms ease;
		pointer-events: none;
	}

	.tip.above {
		transform: translateX(-50%) translateY(-100%);
	}

	@keyframes tip-in {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(4px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0) scale(1);
		}
	}

	.tip::after {
		content: '';
		position: absolute;
		left: 50%;
		width: 10px;
		height: 10px;
		background: #fff;
		border: 1px solid var(--border);
		transform: translateX(-50%) rotate(45deg);
	}

	.tip.above::after {
		bottom: -6px;
		border-top: none;
		border-left: none;
	}

	.tip.below::after {
		top: -6px;
		border-bottom: none;
		border-right: none;
	}

	.tip-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 8px;
	}

	.tip-title {
		font-size: 13px;
		font-weight: 600;
		color: var(--blue-d);
	}

	.badge {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		padding: 2px 7px;
		border-radius: 999px;
		white-space: nowrap;
	}

	.badge.normal {
		color: #1f7a34;
		background: #e6f4ea;
	}

	.badge.warning {
		color: #9a6a05;
		background: #fdf1d9;
	}

	.badge.attention {
		color: #b02525;
		background: #fbe4e4;
	}

	.tip-metrics {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.tip-metrics .row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}

	.tip-metrics dt {
		font-size: 12px;
		color: var(--muted);
	}

	.tip-metrics dd {
		margin: 0;
		font-size: 12px;
		font-weight: 700;
		color: var(--ink);
	}

	.caption {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-top: 10px;
		flex-wrap: wrap;
	}

	.caption .type {
		font-size: 13px;
		font-weight: 600;
		color: var(--blue-d);
	}
    
	.caption .tagline {
		font-size: 12px;
		color: var(--muted);
	}

	@media (max-width: 560px) {
		.bd {
            width: 100%;
        }

		.hot .tag {
			font-size: 10px;
		}

		.tip {
			position: fixed !important;
			left: 12px !important;
			right: 12px !important;
			transform: none !important;
			width: auto !important;
			min-width: 0 !important;
			max-width: none !important;
			max-height: min(60vh, 320px);
			overflow-y: auto;
			pointer-events: auto;
		}

		.tip.above {
			transform: translateY(-100%) !important;
		}

		.tip::after {
			display: none;
		}
	}
</style>