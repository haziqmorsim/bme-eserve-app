<script lang="ts">
    let { route = '' } = $props<{ route?: string }>();
    const n = (count: number) => Array.from({ length: count }, (_, i) => i);
</script>

<div class="skw" role="status" aria-live="polite" aria-label="Loading">
{#if route === '/app'}
    <div class="home">
        <aside class="card side">
            <div class="sk s-input"></div>
            {#each n(7) as i (i)}<div class="sk s-item"></div>{/each}
        </aside>
        <div class="home-main">
            <div class="tabbar"><div class="sk s-tab"></div><div class="sk s-tab"></div></div>
            <div class="sk s-h2 w40"></div>
            <div class="explorer">
                <div class="card design">
                    <div class="design-head-sk">
                        <div class="sk s-h3 w30"></div>
                        <div class="sk s-xs w35"></div>
                    </div>
                    <div class="sk s-diagram"></div>
                    <div class="sk s-xs w60 mt"></div>
                </div>
                <div class="side-panel">
                    <div class="sk s-input"></div>
                    <div class="fbar">
                        <div class="sk s-filterbtn"></div>
                        <div class="sk s-toggle"></div>
                    </div>
                    <div class="parts">
                        {#each n(4) as i (i)}
                            <div class="card part">
                                <div class="p-info">
                                    <div class="sk s-xs w35"></div>
                                    <div class="sk s-md w70"></div>
                                    <div class="sk s-xs w50"></div>
                                    <div class="sk s-sm w25"></div>
                                </div>
                                <div class="p-act">
                                    <div class="sk s-thumb"></div>
                                    <div class="sk s-qty"></div>
                                    <div class="sk s-add"></div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
        </div>
    </div>

{:else if route === '/app/quotes'}
    <div class="sk s-title"></div>
    <div class="card pad">
        <div class="qrow qhead"><div class="sk s-xs"></div><div class="sk s-xs"></div><div class="sk s-xs"></div></div>
        {#each n(3) as i (i)}
            <div class="qrow">
                <div class="ql"><div class="sk s-sm w60"></div><div class="sk s-xs w40"></div></div>
                <div class="sk s-xs cc"></div>
                <div class="sk s-qty cc"></div>
                <div class="sk s-x"></div>
            </div>
        {/each}
    </div>
    <div class="card pad">
        <div class="sk s-sm w30"></div>
        <div class="sk s-textarea mt"></div>
        <div class="sk s-sm w40 mt"></div>
        <div class="sk s-row mt6"></div>
    </div>
    <div class="sk s-submit"></div>

{:else if route === '/app/requests'}
    <div class="sk s-title sm"></div>
    <div class="card filters">
        <div class="sk s-search"></div>
        <div class="sk s-date"></div>
        <div class="sk s-date"></div>
    </div>
    <div class="tabbar"><div class="sk s-tab"></div><div class="sk s-tab"></div></div>
    {#each n(2) as i (i)}
        <div class="card pad mb">
            <div class="rhead">
                <div class="rhead-l"><div class="sk s-md w25"></div><div class="sk s-pill"></div><div class="sk s-pill wide"></div></div>
                <div class="sk s-xs w15"></div>
            </div>
            <div class="cust"><div class="sk s-xs w30"></div><div class="sk s-xs w25"></div></div>
            <div class="tbl4">
                <div class="tr th">{#each n(4) as j (j)}<div class="sk s-xs"></div>{/each}</div>
                {#each n(3) as r (r)}<div class="tr">{#each n(4) as j (j)}<div class="sk s-xs"></div>{/each}</div>{/each}
            </div>
            <div class="sk s-textarea mt"></div>
            <div class="brow"><div class="sk s-btn"></div><div class="sk s-btn"></div></div>
        </div>
    {/each}

{:else if route === '/app/history'}
    <div class="sk s-title"></div>
    <div class="card searchbar"><div class="sk s-search full"></div></div>
    <div class="tabbar">{#each n(3) as i (i)}<div class="sk s-tab"></div>{/each}</div>
    {#each n(2) as i (i)}
        <div class="card pad mb">
            <div class="rhead"><div class="rhead-l"><div class="sk s-md w25"></div><div class="sk s-pill"></div></div><div class="sk s-xs w15"></div></div>
            <div class="cust"><div class="sk s-xs w30"></div><div class="sk s-xs w25"></div></div>
            <div class="tbl4">
                <div class="tr th">{#each n(4) as j (j)}<div class="sk s-xs"></div>{/each}</div>
                {#each n(2) as r (r)}<div class="tr">{#each n(4) as j (j)}<div class="sk s-xs"></div>{/each}</div>{/each}
            </div>
            <div class="rfoot"><div class="sk s-btn"></div></div>
        </div>
    {/each}
    <div class="pager"><div class="sk s-pageitem"></div><div class="sk s-pageitem"></div><div class="sk s-pageitem"></div></div>

{:else if route === '/app/analytics'}
    <div class="head"><div class="sk s-title" style="margin:0;"></div><div class="sk s-btn"></div></div>
    <div class="stats">
        {#each n(4) as i (i)}<div class="card stat"><div class="sk s-xs w60"></div><div class="sk s-num"></div><div class="sk s-xs w40"></div></div>{/each}
    </div>
    <div class="card sect">
        <div class="sk s-h2 w40"></div>
        <div class="sk s-split mt"></div>
        <div class="legend"><div class="sk s-xs w15"></div><div class="sk s-xs w15"></div></div>
    </div>
    <div class="card sect">
        <div class="sk s-h2 w40"></div>
        <div class="ag-tiles mt">{#each n(3) as i (i)}<div class="sk s-tile"></div>{/each}</div>
        {#each n(3) as i (i)}<div class="ag-row"><div class="sk s-md w45"></div><div class="sk s-xs w15"></div><div class="sk s-pill wide"></div></div>{/each}
    </div>
    <div class="grid2">
        {#each n(2) as k (k)}
            <div class="card sect">
                <div class="sk s-h2 w50"></div>
                <div class="bars mt">{#each n(4) as i (i)}<div class="bar-row"><div class="sk s-lbl"></div><div class="sk s-track"></div><div class="sk s-val"></div></div>{/each}</div>
            </div>
        {/each}
    </div>
    <div class="card sect">
        <div class="sk s-h2 w60"></div>
        <div class="ua-stats mt">{#each n(5) as i (i)}<div class="ua-tile"><div class="sk s-num sm"></div><div class="sk s-xs w70"></div></div>{/each}</div>
        <div class="sk s-h3 w30 mt"></div>
        <div class="spark mt">{#each n(14) as i (i)}<div class="sk s-bar-v"></div>{/each}</div>
    </div>
    <div class="grid2">
        {#each n(2) as k (k)}
            <div class="card sect">
                <div class="sk s-h2 w50"></div>
                <div class="bars mt">{#each n(4) as i (i)}<div class="bar-row"><div class="sk s-lbl"></div><div class="sk s-track"></div><div class="sk s-val"></div></div>{/each}</div>
            </div>
        {/each}
    </div>
    <div class="card sect">
        <div class="sk s-h2 w40"></div>
        <div class="feed mt">{#each n(4) as i (i)}<div class="feed-row"><div class="sk s-dot"></div><div class="sk s-xs feed-t"></div><div class="sk s-xs w15"></div></div>{/each}</div>
    </div>

{:else if route === '/app/analytics/forecasts'}
    <div class="head"><div class="sk s-title" style="margin:0;"></div><div class="sk s-btn"></div></div>
    <div class="card pad">
        <div class="sk s-h2 w45"></div>
        <div class="sk s-xs w50 mt6"></div>
        <div class="legend mt"><div class="sk s-xs w20"></div><div class="sk s-xs w20"></div><div class="sk s-xs w15"></div></div>
    </div>
    {#each n(2) as g (g)}
        <div class="card pad mb">
            <div class="sk s-h3 w25"></div>
            <div class="tbl-fc th mt">{#each n(4) as j (j)}<div class="sk s-xs"></div>{/each}</div>
            {#each n(3) as r (r)}
                <div class="tbl-fc">
                    <div class="sk s-xs"></div>
                    <div class="sk s-xs"></div>
                    <div class="sk s-chart"></div>
                    <div class="sk s-xs"></div>
                </div>
            {/each}
        </div>
    {/each}

{:else if route === '/app/enquiries'}
    <div class="sk s-title"></div>
    <div class="card searchbar"><div class="sk s-search full"></div></div>
    <div class="tabbar"><div class="sk s-tab"></div><div class="sk s-tab"></div></div>
    {#each n(3) as i (i)}
        <div class="card pad mb">
            <div class="rhead"><div class="rhead-l"><div class="sk s-md w25"></div><div class="sk s-xs w20"></div></div><div class="sk s-xs w15"></div></div>
            <div class="sk s-xs w30 mt6"></div>
            <div class="sk s-row mt"></div>
            <div class="brow mt"><div class="sk s-btn"></div><div class="sk s-btn"></div></div>
        </div>
    {/each}

{:else if route?.startsWith('/app/settings')}
    <div class="sk s-title"></div>
    <div class="tabbar">{#each n(4) as i (i)}<div class="sk s-tab"></div>{/each}</div>
    <div class="toolbar"><div class="sk s-search-sm"></div><div class="sk s-btn"></div></div>
    <div class="card pad">
        <div class="tbl5 th">{#each n(5) as j (j)}<div class="sk s-xs"></div>{/each}</div>
        {#each n(5) as r (r)}<div class="tbl5">{#each n(5) as j (j)}<div class="sk s-xs"></div>{/each}</div>{/each}
    </div>
    <div class="bd-head mt">
        <div class="sk s-h2 w45"></div>
        <div class="sk s-select"></div>
    </div>
    <div class="toolbar"><div class="sk s-h3 w25"></div><div class="sk s-btn"></div></div>
    <div class="card pad mb">
        <div class="tbl4 th">{#each n(4) as j (j)}<div class="sk s-xs"></div>{/each}</div>
        {#each n(2) as r (r)}<div class="tr">{#each n(4) as j (j)}<div class="sk s-xs"></div>{/each}</div>{/each}
    </div>
    <div class="toolbar"><div class="sk s-h3 w35"></div><div class="sk s-btn"></div></div>
    <div class="card pad">
        <div class="tbl5b th">{#each n(5) as j (j)}<div class="sk s-xs"></div>{/each}</div>
        {#each n(3) as r (r)}<div class="tbl5b">{#each n(5) as j (j)}<div class="sk s-xs"></div>{/each}</div>{/each}
    </div>

{:else if route === '/app/profile'}
    <div class="head"><div class="sk s-title" style="margin:0;"></div><div class="sk s-btn"></div></div>
    <div class="card who">
        <div class="sk s-avatar"></div>
        <div class="who-text"><div class="sk s-md w45"></div><div class="sk s-xs w30 mt6"></div></div>
        <div class="sk s-pill"></div>
    </div>
    <div class="card sect">
        <div class="sk s-h2 w45"></div>
        {#each n(5) as i (i)}<div class="prow"><div class="sk s-xs w25"></div><div class="sk s-xs w40"></div></div>{/each}
    </div>
    <div class="card sect">
        <div class="sk s-h2 w30"></div>
        {#each n(3) as i (i)}<div class="sk s-xs w55 mt6"></div>{/each}
    </div>

{:else if route === '/app/faq'}
    <div class="sk s-title"></div>
    {#each n(5) as i (i)}
        <div class="card faqrow mb">
            <div class="sk s-md w70"></div>
        </div>
    {/each}

{:else if route === '/app/policy'}
    <div class="sk s-title"></div>
    <div class="card pad">
        {#each n(9) as i (i)}<div class="sk s-xs w90 mb6"></div>{/each}
    </div>

{:else}
    <div class="sk s-title"></div>
    {#each n(4) as i (i)}<div class="sk s-row mb"></div>{/each}
{/if}
</div>

<style>
    .skw { animation: skFade 160ms ease both; }

    .card {
        background: #fff;
        border: 1px solid var(--bme-border);
        border-radius: 12px;
        box-shadow: var(--shadow);
    }
    .pad { padding: 18px; }
    .mb { margin-bottom: 14px; }
    .mb6 { margin-bottom: 6px; }
    .mt { margin-top: 12px; }
    .mt6 { margin-top: 6px; }

    .sk {
        border-radius: 8px;
        background: linear-gradient(90deg, #e9edf1 25%, #f4f7f9 37%, #e9edf1 63%);
        background-size: 400% 100%;
        animation: skShimmer 1.3s ease infinite;
    }

    .w15{width:15%}.w20{width:20%}.w25{width:25%}.w30{width:30%}
    .w35{width:35%}.w40{width:40%}.w45{width:45%}.w50{width:50%}.w55{width:55%}
    .w60{width:60%}.w70{width:70%}.w90{width:90%}

    .s-title{ height:28px; width:200px; margin:6px 0 18px; }
    .s-title.sm{ width:150px; }
    .s-xs{ height:12px; }
    .s-sm{ height:14px; }
    .s-md{ height:18px; }
    .s-h2{ height:20px; }
    .s-h3{ height:18px; }
    .s-row{ height:40px; border-radius:8px; }
    .s-input{ height:42px; border-radius:8px; width:100%; }
    .s-textarea{ height:70px; border-radius:8px; }
    .s-btn{ height:38px; width:110px; border-radius:8px; }
    .s-submit{ height:46px; width:100%; border-radius:8px; }
    .s-pill{ height:22px; width:64px; border-radius:999px; }
    .s-pill.wide{ width:120px; }
    .s-tab{ height:36px; width:96px; border-radius:8px; flex:1; max-width:150px; }
    .s-tile{ height:74px; border-radius:10px; }
    .cc{ margin:0 auto; width:60%; }
    .s-x{ height:16px; width:16px; margin-left:auto; }
    .s-num{ height:34px; width:70%; }
    .s-num.sm{ height:24px; width:50%; margin:0 auto; }
    .s-dot{ height:8px; width:8px; border-radius:50%; flex:0 0 auto; }
    .s-select{ height:38px; width:220px; border-radius:8px; }
    .s-search-sm{ height:38px; width:220px; border-radius:8px; }
    .s-filterbtn{ height:38px; width:170px; border-radius:10px; }
    .s-toggle{ height:38px; width:190px; border-radius:10px; }
    .s-avatar{ height:58px; width:58px; border-radius:50%; flex:0 0 auto; }
    .s-chart{ height:28px; border-radius:6px; }
    .s-bar-v{ width:100%; height:100%; border-radius:4px 4px 0 0; }
    .s-pageitem{ height:32px; width:32px; border-radius:8px; }

    .filters{ display:flex; gap:12px; align-items:flex-end; padding:14px; margin-bottom:16px; flex-wrap:wrap; }
    .s-search{ height:40px; border-radius:8px; flex:1; min-width:220px; }
    .s-search.full{ width:100%; }
    .s-date{ height:40px; width:150px; border-radius:8px; }
    .searchbar{ padding:14px; margin-bottom:16px; display:flex; }
    .searchbar .s-search{ margin:0; }

    .rhead{ display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; }
    .rhead-l{ display:flex; align-items:center; gap:10px; }
    .cust{ display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
    .rfoot{ display:flex; justify-content:flex-end; margin-top:14px; padding-top:12px; border-top:1px solid var(--bme-border); }
    .prow{ display:flex; gap:16px; padding:10px 0; border-bottom:1px solid var(--bme-border); }
    .prow:last-child{ border-bottom:none; }
    .pager{ display:flex; justify-content:center; gap:8px; margin-top:18px; }

    .tbl4 .tr, .tbl4 .th{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; padding:9px 0; border-top:1px solid var(--bme-border); }
    .tbl4 .th{ border-top:none; }
    .tbl5{ display:grid; grid-template-columns:repeat(5,1fr); gap:12px; padding:11px 0; border-top:1px solid var(--bme-border); }
    .tbl5.th{ border-top:none; }
    .tbl5b{ display:grid; grid-template-columns:0.6fr 1.4fr 1fr 2fr 0.9fr; gap:12px; padding:11px 0; border-top:1px solid var(--bme-border); align-items:center; }
    .tbl5b.th{ border-top:none; }
    .tbl-fc{ display:grid; grid-template-columns:1.6fr 0.8fr 2fr 0.8fr; gap:12px; padding:10px 0; border-top:1px solid var(--bme-border); align-items:center; }
    .tbl-fc.th{ border-top:none; }
    .brow{ display:flex; gap:10px; margin-top:14px; }
    .toolbar{ display:flex; justify-content:space-between; align-items:center; gap:12px; margin:14px 0; }
    .tabbar{ display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; }

    .qrow{ display:grid; grid-template-columns:2fr 0.9fr 0.8fr 40px; align-items:center; gap:12px; padding:14px 0; border-bottom:1px solid var(--bme-border); }
    .qrow.qhead{ padding-top:10px; }
    .ql{ display:flex; flex-direction:column; gap:6px; }
    .s-qty{ height:34px; width:70px; border-radius:8px; margin:0 auto; }

    .head{ display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:18px; }
    .stats{ display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:16px; }
    .stat{ padding:16px; display:flex; flex-direction:column; gap:10px; }
    .sect{ padding:18px; margin-bottom:14px; }
    .s-split{ height:20px; border-radius:999px; width:100%; }
    .legend{ display:flex; gap:18px; margin-top:12px; flex-wrap:wrap; }
    .ag-tiles{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:14px; }
    .ag-row{ display:flex; align-items:center; gap:12px; padding:10px 0; border-top:1px solid var(--bme-border); }
    .ag-row .s-md{ flex:1; }
    .bars{ display:flex; flex-direction:column; gap:12px; }
    .bar-row{ display:grid; grid-template-columns:90px 1fr auto; align-items:center; gap:12px; }
    .s-lbl{ height:14px; }
    .s-track{ height:14px; border-radius:999px; }
    .s-val{ height:14px; width:56px; }
    .grid2{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }

    .ua-stats{ display:grid; grid-template-columns:repeat(5,1fr); gap:12px; }
    .ua-tile{ display:flex; flex-direction:column; align-items:center; gap:6px; padding:10px; }
    .spark{ display:flex; align-items:flex-end; gap:6px; height:70px; }
    .feed{ display:flex; flex-direction:column; gap:10px; }
    .feed-row{ display:flex; align-items:center; gap:10px; }
    .feed-t{ flex:1; }

    .who{ display:flex; align-items:center; gap:16px; padding:20px; margin-bottom:16px; flex-wrap:wrap; }
    .who-text{ flex:1; min-width:0; }

    .faqrow{ padding:18px 20px; }

    .bd-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:16px; }

    .home{ display:grid; grid-template-columns:280px 1fr; gap:10px; align-items:stretch; }
    .side{ padding:16px; display:flex; flex-direction:column; gap:8px; }
    .s-item{ height:34px; border-radius:8px; }
    .home-main{ min-width:0; }
    .explorer{ display:flex; flex-direction:column; gap:16px; }
    .design{ padding:16px; width:100%; }
    .design-head-sk{ display:flex; justify-content:space-between; align-items:baseline; gap:12px; flex-wrap:wrap; }
    .s-diagram{ height:320px; border-radius:10px; margin-top:12px; }
    .side-panel{ min-width:0; display:flex; flex-direction:column; gap:14px; }
    .fbar{ display:flex; gap:10px; }
    .parts{ display:flex; flex-direction:column; gap:12px; }
    .part{ padding:16px; display:flex; align-items:center; justify-content:space-between; gap:14px; }
    .p-info{ flex:1; display:flex; flex-direction:column; gap:8px; min-width:0; }
    .p-act{ display:flex; align-items:center; gap:10px; }
    .s-thumb{ height:66px; width:66px; border-radius:10px; }
    .s-add{ height:38px; width:64px; border-radius:8px; }

    @keyframes skShimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
    @keyframes skFade { from { opacity: 0; } to { opacity: 1; } }

    @media (max-width: 860px) {
        .home{ grid-template-columns:1fr; }
        .grid2{ grid-template-columns:1fr; }
    }
    @media (max-width: 720px) {
        .stats{ grid-template-columns:repeat(2,1fr); }
        .qrow{ grid-template-columns:1fr auto; }
        .qrow .ql{ grid-column:1 / -1; }
        .qrow.qhead{ display:none; }
        .ua-stats{ grid-template-columns:repeat(2,1fr); }
        .tbl-fc, .tbl-fc.th{ grid-template-columns:1fr; }
    }
    @media (max-width: 640px) {
        .tabbar .s-tab{ max-width:none; }
        .rhead{ flex-direction:column; align-items:flex-start; gap:8px; }
        .cust{ margin-bottom:10px; }
        .tbl4 .tr, .tbl4 .th, .tbl5, .tbl5.th, .tbl5b, .tbl5b.th{ grid-template-columns:1fr; gap:4px; }
        .toolbar{ flex-direction:column; align-items:stretch; }
        .s-search-sm, .s-select{ width:100%; }
        .who{ flex-direction:column; align-items:flex-start; }
        .prow{ flex-direction:column; gap:4px; }
    }

    @media (prefers-reduced-motion: reduce) {
        .sk { animation-duration: 2.4s; }
    }
</style>