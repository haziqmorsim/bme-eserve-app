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

    let open = $state<string |null>(null);

    const telemetry = $derived(
        Object.fromEntries(
            sections.map((s: ResolvedSection) => [s.key, sectionTelemetry(boilerCode, s.key)])
        )
    );

    function clickable(s: ResolvedSection) {
        return mode === 'parts' && !!s.componentId;
    }

    function handleClick(s: ResolvedSection) {
        if (mode === 'parts') {
            if (s.componentId) onselect?.(s.componentId, s.key);
        } else {
            open = open === s.key ? null : s.key;
        }
    }

    function tipStyle(s: ResolvedSection) {
        const cx = Math.min(85, Math.max(15, s.rect.l + s.rect.w / 2));
        const below = s.rect.t < 42;
        const y = below ? `top:${s.rect.t + s.rect.h + 1.5}%;` : `bottom:${100 - s.rect.t + 1.5}%;`;
        return `left:${cx}%;${y}`;
    }
    function tipPlacement(s: ResolvedSection) {
        return s.rect.t < 42 ? 'below' : 'above';
    }
</script>

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
            onpointerenter={() => (open = s.key)} 
            onpointerleave={() => (open = open === s.key ? null : open)} 
            onfocus={() => (open = s.key)} 
            onblur={() => (open = null)} 
            onclick={() => handleClick(s)}
            >
                <span class="dot"></span>
                <span class="tag">{s.label}</span>
            </button>
        {/each}

        {#if mode === 'dashboard'}
            {#each sections as s (s.key)}
                {#if open === s.key}
                    <div class="tip {tipPlacement(s)}" style={tipStyle(s)} role="tooltip">
                        <div class="tip-head">
                            <span class="tip-title">{s.label}</span>
                            <span class="badge {telemetry[s.key].state.toLowerCase()}">{telemetry[s.key].state}</span>
                        </div>
                        <dl class="tip-metrics">
                            {#each telemetry[s.key].metrics as m}
                                <div class="row"><dt>{m.label}</dt><dd>{m.value}</dd></div>
                            {/each}
                        </dl>
                    </div>
                {/if}
            {/each}
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
		position: absolute;
		z-index: 5;
		transform: translateX(-50%);
		width: 230px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 10px;
		box-shadow: 0 10px 30px rgba(12, 51, 88, 0.18);
		padding: 10px 12px;
		animation: tip-in 140ms ease;
		pointer-events: none;
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
        justify-content: center;
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
        
        .tip {
			min-width: 150px;
			max-width: 200px;
		}
		.hot .tag {
			font-size: 10px;
		}
	}
</style>