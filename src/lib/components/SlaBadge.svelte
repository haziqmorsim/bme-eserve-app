<script lang="ts">
    import { slaState, ageLabel, slaStateBusiness, businessAgeLabel, SLA_LABEL } from "$lib/sla";

    let { since, businessHours = false } = $props<{ since: string; businessHours?: boolean }>();

    let now = $state(Date.now());
    $effect(() => {
        const t = setInterval(() => (now = Date.now()), 60_000);
        return () => clearInterval(t);
    });

    let sla = $derived(businessHours ? slaStateBusiness(since, now) : slaState(since, now));
    let age = $derived(businessHours ? businessAgeLabel(since, now) : ageLabel(since, now));
</script>

<span class="sla {sla}" title="At this level for {age}">
    <span class="sla-dot"></span>{SLA_LABEL[sla]} · {age}
</span>

<style>
    .sla {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
    }
 
    .sla-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
        opacity: 0.85;
    }
 
    .sla.ontrack { 
        background-color: #e4f3d8; 
        color: #2f5e18; 
    }
    
    .sla.aging   { 
        background-color: #fff3d6; 
        color: #97700a; 
    }
    
    .sla.overdue { 
        background-color: #fbe3e0; 
        color: #8e261b; 
        }
</style>