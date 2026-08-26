<script lang="ts">
    import type { Boiler, Project, BoilerProject } from "$lib/types";
    import { logActivity } from "$lib/activity";
    import { ChevronDown } from "@lucide/svelte";

    let {
        boilers, 
        projects = [],
        boilerProjects = [],
        activeBoilerId, 
        activeProjectId = null, 
        customerNoBoilers = false, 
        supabase = null, 
        profile = null
    } = $props<{
        boilers: Boiler[];
        projects?: Project[];
        boilerProjects?: BoilerProject[];
        activeBoilerId: string | null;
        activeProjectId?: string | null;
        customerNoBoilers?: boolean;
        supabase?: any;
        profile?: any;
    }>();

    let search = $state('');

    let searchLogged = false;
    let searchTimer: ReturnType<typeof setTimeout> | undefined;

    function onSearchInput() {
        clearTimeout(searchTimer);
        if (!search.trim()) {
            searchLogged = false;
            return;
        }
        if (searchLogged) return;
        searchTimer = setTimeout(() => {
            searchLogged = true;
            logActivity(
                supabase, 
                profile ? { id: profile.id, role: profile.role } : null, 
                { event_type: 'page_view', path: '/app', meta: { trigger: 'boiler_search'}}
            );
        }, 700);
    }

    let query = $derived(search.trim().toLowerCase());

    const UNASSIGNED = '__unassigned__';

    type BoilerGroup = { id: string; projectNo: string; projectName: string | null; boilers: Boiler[] };

    let projectIdsByBoiler = $derived.by(() => {
        const m: Record<string, string[]> = {};
        for (const bp of boilerProjects as BoilerProject[]) (m[bp.boiler_id] ??= []).push(bp.project_id);
        return m;
    });

    let allGroups = $derived.by(() => {
        const byId = new Map<string, BoilerGroup>();

        for (const b of boilers as Boiler[]) {
            const pids = projectIdsByBoiler[b.id] ?? [];
            if (pids.length === 0) {
                if (!byId.has(UNASSIGNED)) {
                    byId.set(UNASSIGNED, { id: UNASSIGNED, projectNo: 'Unassigned', projectName: null, boilers: [] });
                }
                byId.get(UNASSIGNED)!.boilers.push(b);
                continue;
            }
            for (const pid of pids) {
                const proj = (projects as Project[]).find((p) => p.id === pid);
                if (!proj) continue;
                if (!byId.has(pid)) {
                    byId.set(pid, { id: pid, projectNo: proj.project_no, projectName: proj.name, boilers: [] });
                }
                byId.get(pid)!.boilers.push(b);
            }
        }

        const sortOrder = (id: string) => (projects as Project[]).find((p) => p.id === id)?.sort_order ?? 0;
        const list = [...byId.values()].filter((g) => g.id !== UNASSIGNED);
        list.sort((a, b) => sortOrder(a.id) - sortOrder(b.id) || a.projectNo.localeCompare(b.projectNo));

        const unassigned = byId.get(UNASSIGNED);
        if (unassigned) list.push(unassigned);

        return list;
    });

    function boilerMatches(b: Boiler) {
        return b.code.toLowerCase().includes(query) || (b.name || '').toLowerCase().includes(query);
    }

    let groups = $derived.by(() => {
        if (!query) return allGroups;

        const result: BoilerGroup[] = [];
        for (const g of allGroups) {
            const projectMatches =
                g.projectNo.toLowerCase().includes(query) || (g.projectName ?? '').toLowerCase().includes(query);
            if (projectMatches) {
                result.push(g);
                continue;
            }
            const matchedBoilers = g.boilers.filter(boilerMatches);
            if (matchedBoilers.length > 0) {
                result.push({ ...g, boilers: matchedBoilers });
            }
        }
        return result;
    });

    let totalMatches = $derived(groups.reduce((n, g) => n + g.boilers.length, 0));

    let resolvedActiveProjectId = $derived.by(() => {
        if (!activeBoilerId) return null;
        if (activeProjectId && groups.some((g) => g.id === activeProjectId && g.boilers.some((b) => b.id === activeBoilerId))) {
            return activeProjectId;
        }
        const first = groups.find((g) => g.boilers.some((b) => b.id === activeBoilerId));
        return first ? first.id : null;
    });

    let openProjects = $state<Set<string>>(new Set());

    function toggleProject(id: string) {
        const next = new Set(openProjects);
        if (next.has(id)) next.delete(id); else next.add(id);
        openProjects = next;
    }

    function isOpen(id: string) {
        if (query !== '' || openProjects.has(id)) return true;
        return id === resolvedActiveProjectId;
    }
</script>

<aside class="card sidebar">
    {#if customerNoBoilers}
        <p class="no-boilers">No boilers assigned yet.</p>
    {:else}
        <input
            type="search" 
            class="boiler-search" 
            placeholder="Search projects or boilers..." 
            bind:value={search} 
            oninput={onSearchInput}
        />

        {#if totalMatches === 0}
            <p class="no-results">No boilers found.</p>
        {:else}
            <div class="project-groups">
                {#each groups as g (g.id)}
                    <div class="proj-group" class:open={isOpen(g.id)}>
                        <button
                            type="button"
                            class="proj-head"
                            onclick={() => toggleProject(g.id)}
                            aria-expanded={isOpen(g.id)}
                        >
                            <span class="proj-title">
                                <strong class:unassigned={g.id === UNASSIGNED}>{g.projectNo}</strong>
                                {#if g.projectName}<span class="proj-sub">{g.projectName}</span>{/if}
                            </span>
                            <span class="proj-count">{g.boilers.length}</span>
                            <span class="chev" class:rot={isOpen(g.id)}><ChevronDown size={15} /></span>
                        </button>
                        {#if isOpen(g.id)}
                            <ul class="boilers">
                                {#each g.boilers as boiler (boiler.id)}
                                    <li>
                                        <a href={`/app?boiler=${boiler.id}&project=${g.id}&tab=dashboard`} class:active={boiler.id === activeBoilerId && g.id === resolvedActiveProjectId}>
                                            <strong>{boiler.code}</strong>
                                            {#if boiler.name}<span>{boiler.name}</span>{/if}
                                        </a>
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    {/if}
</aside>

<style>
    .boiler-search {
        margin-bottom: 14px;
    }

    .no-boilers {
        color: var(--bme-muted);
        font-size: 13px;
        text-align: center;
    }

    .no-results {
        color: var(--bme-muted);
        font-size: 13px;
        padding: 8px 4px;
        margin: 0;
    }

    .sidebar {
        padding: 16px;
        height: 100%;
    }

    .project-groups {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .proj-group {
        border: 1px solid var(--bme-border);
        border-radius: 8px;
        overflow: hidden;
        transition: border-color 140ms ease;
    }

    .proj-head {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 9px 10px;
        background: none;
        border: none;
        font-family: inherit;
        color: var(--bme-ink);
        text-align: left;
        cursor: pointer;
    }

    .proj-head:hover {
        background: var(--bme-hover);
    }

    .proj-title {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
    }

    .proj-title strong {
        font-size: 15px;
        font-weight: bold;
    }

    .proj-title strong.unassigned {
        color: var(--bme-muted);
    }

    .proj-sub {
        font-size: 12px;
        color: var(--bme-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .proj-count {
        flex: 0 0 auto;
        font-size: 11.5px;
        font-weight: 700;
        color: var(--bme-muted);
        background: var(--bme-hover);
        border-radius: 999px;
        padding: 2px 8px;
    }

    .chev {
        flex: 0 0 auto;
        display: inline-flex;
        color: var(--bme-muted);
        transition: transform 140ms ease;
    }

    .chev.rot {
        transform: rotate(180deg);
        color: var(--bme-dark-blue);
    }

    .boilers {
        list-style: none;
        margin: 0;
        padding: 2px 6px 6px;
    }

    .boilers li {
        margin: 5px 0;
    }

    .boilers li a {
        display: flex;
        flex-direction: column;
        font-size: 13px;
        gap: 1px;
        padding: 9px 12px;
        border-radius: 8px;
        border: 1px solid var(--bme-bg);
        color: var(--bme-ink);
    }

    .boilers li a:hover {
        background: var(--bme-hover);
    }

    .boilers li a.active {
        background: var(--bme-darker-blue);
        color: #ffffff;
    }

    .boilers li a.active span {
        color: #eaeff3;
    }

    .boilers li a span {
        font-size: 11px;
        color: var(--bme-muted);
    }

    @media (max-width: 860px) {
        .sidebar {
            height: fit-content;
        }
    }
</style>