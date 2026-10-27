<script lang="ts">
    let {
        checked,
        indeterminate = false,
        disabled = false,
        label,
        title = '',
        onchange
    }: {
        checked: boolean;
        indeterminate?: boolean;
        disabled?: boolean;
        label: string;
        title?: string;
        onchange: (checked: boolean) => void;
    } = $props();

    let el = $state<HTMLInputElement | null>(null);

    $effect(() => {
        if (el) el.indeterminate = indeterminate && !checked;
    });
</script>

<input 
    bind:this={el} 
    type="checkbox" 
    class="row-check" 
    {checked} 
    {disabled} 
    aria-label={label} 
    title={title || label} 
    onchange={(e) => onchange(e.currentTarget.checked)}
/>

<style>
    .row-check {
        width: 17px;
        height: 17px;
        padding: 0;
        margin: 0;
        vertical-align: middle;
        accent-color: var(--bme-dark-blue);
        cursor: pointer;
    }
 
    .row-check:disabled {
        cursor: not-allowed;
        opacity: 0.45;
    }
</style>