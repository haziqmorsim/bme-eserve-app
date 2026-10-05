<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";

    let { children } = $props();

    const SECTIONS = [
        { href: '/app/analytics/customer-requests', label: 'Customer Requests'},
        // { href: '/app/analytics/forecasts', label: 'Demand Forecasts'},
        { href: '/app/analytics/email-log', label: 'E-mail Deliveries'},
        // { href: '/app/analytics/service-records', label: 'Service Records'},
        // { href: '/app/analytics/suggestions', label: 'Suggestion Reviews'},
        // { href: '/app/analytics/training-data', label: 'Training Data'},
        { href: '/app/analytics/user-activities', label: 'User Activities'}
    ];

    let current = $derived(
        SECTIONS.find((s) => $page.url.pathname === s.href || $page.url.pathname.startsWith(s.href + '/'))?.href ?? SECTIONS[0].href
    );

    function change(e: Event) {
        const href = (e.currentTarget as HTMLSelectElement).value;
        if (href !== current) goto(href);
    }
</script>

<h1>Analytics</h1>
    
<label class="picker">
    <span class="sr-only">Analytics section</span>
    <select value={current} onchange={change} aria-label="Analytics section">
        {#each SECTIONS as s (s.href)}
            <option value={s.href}>{s.label}</option>
        {/each}
    </select>
</label>

{@render children()}

<style>
	h1 {
		margin: 5px 0 10px;
	}
 
	.picker {
		display: block;
		width: 180px;
		max-width: 100%;
		margin-bottom: 20px;
	}
 
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
 
	@media (max-width: 480px) {
		.picker {
			width: 100%;
		}
	}
</style>