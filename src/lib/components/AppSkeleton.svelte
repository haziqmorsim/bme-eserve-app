<script lang="ts">
    let {
        route = '',
        tab = '',
        hasBoiler = true
    }: {
        route?: string;
        tab?: string;
        hasBoiler?: boolean;
    } = $props();

    const n = (count: number) => Array.from({ length: count }, (_, i) => i);

    // Dashboard sub-tab labels, with a width that matches each real tab (padding 18px + text).
    const SUBTABS = [92, 78, 78, 78, 99, 105, 105, 99, 99, 112];

    const ANALYTICS_ROUTES = [
        '/app/analytics',
        '/app/analytics/customer-requests',
        '/app/analytics/user-activities',
        '/app/analytics/forecasts',
        '/app/analytics/suggestions',
        '/app/analytics/training-data',
        '/app/analytics/service-records',
        '/app/analytics/email-log',
        '/app/analytics/audit-log'
    ];
    let analyticsPage = $derived(
        route === '/app/analytics' ? '/app/analytics/customer-requests' : route
    );
</script>

<!--
    Every block below mirrors the markup and spacing of the page it stands in for.
    Text placeholders (.t) are inline-blocks holding a non-breaking space, so each row takes the
    height of the real font and line-height on any device. Boxes that hold real inputs and buttons
    use the same padding and font size as the real control.
-->
{#snippet bar(w: string)}<span class="t" style:width={w}>&nbsp;</span>{/snippet}

<!-- Real (disabled) form controls are used wherever the page has one, so their height, margins and
     baseline behave exactly like the real control on every platform. -->
{#snippet inp(type: string = 'text', pad: string = '', fs: string = '', padLeft: string = '')}
    <input
        class="sk box"
        {type}
        disabled
        tabindex="-1"
        aria-hidden="true"
        style:padding={pad || undefined}
        style:padding-left={padLeft || undefined}
        style:font-size={fs || undefined} />
{/snippet}

{#snippet ta(rows: number)}
    <textarea class="sk box" {rows} disabled tabindex="-1" aria-hidden="true"></textarea>
{/snippet}

{#snippet btn(w: string, pad: string = '10px 18px', fs: string = '13.3333px', border: string = '0')}
    <span class="sk btn" style:padding={pad} style:font-size={fs} style:width={w} style:border-width={border}>&nbsp;</span>
{/snippet}

{#snippet tabs(widths: number[], pad: string = '9px 22px', fs: string = '13.3333px', mb: string = '20px')}
    <div class="tabbar" style:margin-bottom={mb}>
        {#each widths as w, i (i)}
            <span class="sk tab" style:padding={pad} style:font-size={fs} style:width={`${w}px`}>&nbsp;</span>
        {/each}
    </div>
{/snippet}

{#snippet h1(w: string, margin: string = '5px 0 15px')}
    <h1 style:margin>{@render bar(w)}</h1>
{/snippet}

{#snippet searchFilter(placeholderOnly: boolean = false)}
    <div class="card filters">
        <div class="f-search">{@render inp('search', '', '', '32px')}</div>
        {#each n(2) as i (i)}
            <label class="f">
                <span class="f-lbl">{@render bar('46px')}</span>
                {@render inp('date', '8px 10px')}
            </label>
        {/each}
    </div>
{/snippet}

{#snippet pager()}
    <div class="pager">
        <span class="pager-info">{@render bar('150px')}</span>
        <div class="pager-btns">
            {#each n(5) as i (i)}<span class="sk pg-btn"></span>{/each}
        </div>
    </div>
{/snippet}

{#snippet statCard(valueFs: string, lineH: string, gap: string, pad: string, labelFs: string, subFs: string)}
    <div class="card stat" style:padding={pad} style:gap>
        <span class="s-l" style:font-size={labelFs}>{@render bar('60%')}</span>
        <span class="s-v" style:font-size={valueFs} style:line-height={lineH}>{@render bar('38%')}</span>
        <span class="s-s" style:font-size={subFs}>{@render bar('72%')}</span>
    </div>
{/snippet}

{#snippet quoteHead()}
    <div class="qhead">
        <div class="qhead-l">
            <strong class="ref">{@render bar('120px')}</strong>
            <span class="sk status-pill"></span>
        </div>
        <small class="qdate">{@render bar('120px')}</small>
    </div>
{/snippet}

{#snippet quoteTable(rows: number)}
    <table class="qt">
        <thead>
            <tr>{#each n(4) as i (i)}<th>{@render bar('70%')}</th>{/each}</tr>
        </thead>
        <tbody>
            {#each n(rows) as r (r)}
                <tr>
                    <td>{@render bar('60%')}</td>
                    <td class="left">{@render bar('86%')}</td>
                    <td>{@render bar('50%')}</td>
                    <td>{@render bar('24%')}</td>
                </tr>
            {/each}
        </tbody>
    </table>
{/snippet}

{#snippet dataTable(cols: number, rows: number, twoLine: number = -1, pad: string = '0.7rem')}
    <table class="dt" style:--cell-pad={pad}>
        <thead>
            <tr>{#each n(cols) as c (c)}<th>{@render bar(c === 0 ? '50%' : '64%')}</th>{/each}</tr>
        </thead>
        <tbody>
            {#each n(rows) as r (r)}
                <tr>
                    {#each n(cols) as c (c)}
                        <td>
                            {@render bar(c === twoLine ? '80%' : `${50 + ((r + c * 3) % 4) * 10}%`)}
                            {#if c === twoLine}<br /><span class="td-sub">{@render bar('55%')}</span>{/if}
                        </td>
                    {/each}
                </tr>
            {/each}
        </tbody>
    </table>
{/snippet}

{#snippet barRows(count: number)}
    <div class="bars">
        {#each n(count) as i (i)}
            <div class="bar-row">
                <span class="bar-key">{@render bar('80%')}</span>
                <div class="sk track"></div>
                <span class="bar-val">{@render bar('22px')}</span>
            </div>
        {/each}
    </div>
{/snippet}

<div class="skw" role="status" aria-live="polite" aria-label="Loading">
    <!-- ==================== Home: project list + dashboard / spare parts ==================== -->
    {#if route === '/app'}
        <div class="layout">
            <aside class="card sidebar">
                <div class="sk expand-all">&nbsp;</div>
                <div class="search-row">
                    <input type="search" class="sk search" disabled tabindex="-1" aria-hidden="true" />
                    <span class="sk collapse-btn"></span>
                </div>
                <div class="project-groups">
                    {#each n(7) as i (i)}
                        <div class="proj-group">
                            <div class="proj-head">
                                <span class="proj-title">
                                    <strong>{@render bar(`${46 + ((i * 7) % 3) * 8}%`)}</strong>
                                    <span class="proj-sub">{@render bar(`${58 + ((i * 5) % 4) * 8}%`)}</span>
                                </span>
                            </div>
                        </div>
                    {/each}
                </div>
            </aside>

            <div class="content">
                {#if !hasBoiler}
                    <div class="card empty">
                        <div class="sk empty-bp"></div>
                        <div class="empty-text">
                            <h2>{@render bar('180px')}</h2>
                            <p>{@render bar('330px')}</p>
                        </div>
                    </div>
                {:else}
                    <div class="home-tabbar">
                        <span class="sk home-tab" style:width="127px">&nbsp;</span>
                        <span class="sk home-tab" style:width="142px">&nbsp;</span>
                    </div>

                    {#if tab === 'parts'}
                        <h2 class="title">{@render bar('240px')}</h2>
                        <p class="desc parts-desc">{@render bar('170px')}</p>

                        <div class="card design">
                            <div class="design-head">
                                <h3 class="dh-title">{@render bar('120px')}</h3>
                                <span class="dh-hint">{@render bar('520px')}</span>
                            </div>
                            <div class="explorer">
                                <div class="sk stage"></div>
                                <aside class="pf">
                                    <div class="pf-top">
                                        <div class="crumbs"><span class="crumb">{@render bar('64px')}</span></div>
                                        <div class="sk searchbox"></div>
                                    </div>
                                    <div class="pf-body">
                                        <div class="head">
                                            <h3>{@render bar('140px')}</h3>
                                            <p>{@render bar('260px')}</p>
                                        </div>
                                        <div class="list">
                                            {#each n(9) as i (i)}
                                                <div class="row">
                                                    <span class="sk row-bar"></span>
                                                    <span class="tx">
                                                        <b>{@render bar(`${50 + ((i * 7) % 4) * 9}%`)}</b>
                                                        <span class="meta">{@render bar(`${42 + ((i * 5) % 3) * 10}%`)}</span>
                                                    </span>
                                                    <span class="sk chev"></span>
                                                </div>
                                            {/each}
                                        </div>
                                    </div>
                                </aside>
                            </div>
                        </div>
                    {:else}
                        <h2 class="title">{@render bar('260px')}</h2>
                        <p class="desc">{@render bar('180px')}</p>

                        <div class="subtabs">
                            {#each SUBTABS as w, i (i)}
                                <span class="sk stab" style:width={`${w}px`}>&nbsp;</span>
                            {/each}
                        </div>
                        <select class="sk sub-select" disabled tabindex="-1" aria-hidden="true"></select>

                        <div class="card design-card">
                            <div class="design-head">
                                <h3 class="dh-title"><span class="sk live-dot"></span>{@render bar('120px')}</h3>
                                <span class="hint">{@render bar('480px')}</span>
                            </div>
                            <div class="sk b3d"></div>
                        </div>

                        <div class="grid">
                            {#each n(15) as i (i)}
                                <div class="card spec">
                                    <span class="k">{@render bar(`${52 + ((i * 7) % 4) * 9}%`)}</span>
                                    <span class="v">{@render bar(`${34 + ((i * 5) % 3) * 10}%`)}</span>
                                </div>
                            {/each}
                        </div>
                    {/if}
                {/if}
            </div>
        </div>

    <!-- ==================== Cart List ==================== -->
    {:else if route === '/app/quotes'}
        {@render h1('190px')}
        <div class="card q-list">
            <div class="q-row q-head">
                <span>{@render bar('34%')}</span><span>{@render bar('50%')}</span><span>{@render bar('60%')}</span><span></span>
            </div>
            {#each n(3) as i (i)}
                <div class="q-row">
                    <span class="q-part">
                        <span class="sk q-thumb"></span>
                        <span class="q-ptext">
                            <strong>{@render bar('120px')}</strong>
                            <small>{@render bar('170px')}</small>
                        </span>
                    </span>
                    <span>{@render bar('60%')}</span>
                    <span class="q-qty">{@render inp()}</span>
                    <span class="q-x"><span class="sk q-x-btn">&nbsp;</span></span>
                </div>
            {/each}
        </div>
        <div class="card q-notes">
            <label class="q-label"><span class="q-label-t">{@render bar('150px')}</span>
                {@render ta(3)}
            </label>
            <div class="q-attach">
                <span class="q-attach-label">{@render bar('160px')}</span>
                {@render inp('text', '6px 10px')}
                <span class="q-attach-hint">{@render bar('100%')}<br />{@render bar('40%')}</span>
            </div>
            <div class="q-submit"><span class="sk btn" style:padding="10px 18px" style:font-size="16px" style:width="150px">&nbsp;</span></div>
        </div>

    <!-- ==================== Requests (staff) ==================== -->
    {:else if route === '/app/requests'}
        {@render h1('140px')}
        {@render searchFilter()}
        {#each n(2) as i (i)}
            <div class="card quote">
                {@render quoteHead()}
                <div class="timeline">
                    <ol>
                        {#each n(4) as s (s)}
                            <li>
                                <span class="sk dot"></span>
                                <span class="tl-label">{@render bar('62%')}</span>
                                <span class="tl-at">{@render bar('56%')}</span>
                            </li>
                        {/each}
                    </ol>
                </div>
                <div class="customer">
                    <p>{@render bar('220px')}</p>
                    <p>{@render bar('170px')}</p>
                </div>
                {@render quoteTable(3)}
                <label class="action-field">
                    <p class="field-label">{@render bar('110px')}</p>
                    {@render ta(3)}
                    <small class="field-help">{@render bar('230px')}</small>
                </label>
                <label class="action-field">
                    <p class="field-label">{@render bar('190px')}</p>
                    {@render ta(2)}
                </label>
                <div class="actions">
                    {@render btn('100px', '8px 14px', '13.3333px', '1px')}
                    {@render btn('68px', '10px 18px')}
                    {@render btn('72px', '8px 14px', '13.3333px', '1px')}
                </div>
            </div>
        {/each}

    <!-- ==================== History ==================== -->
    {:else if route === '/app/history'}
        {@render h1('120px')}
        {@render searchFilter()}
        {@render tabs([112, 116])}
        <section class="block">
            {#each n(2) as i (i)}
                <div class="card quote">
                    {@render quoteHead()}
                    <div class="customer tight">
                        <p>{@render bar('220px')}</p>
                        <p>{@render bar('170px')}</p>
                    </div>
                    {@render quoteTable(2)}
                    <div class="h-timeline">
                        <span class="tl-title">{@render bar('110px')}</span>
                        {#each n(2) as r (r)}
                            <div class="tl-row">
                                <p class="tl-when">{@render bar('140px')}</p>
                                <p class="tl-line">{@render bar('220px')}</p>
                                <p class="tl-line">{@render bar('330px')}</p>
                            </div>
                        {/each}
                        <span class="sk add-btn" style:width="112px">&nbsp;</span>
                    </div>
                    <span class="sk reopen-btn" style:width="86px">&nbsp;</span>
                </div>
            {/each}
            {@render pager()}
        </section>

    <!-- ==================== Enquiries ==================== -->
    {:else if route === '/app/enquiries'}
        {@render h1('150px')}
        {@render searchFilter()}
        {@render tabs([150, 130], '9px 20px', '13.3333px', '16px')}
        {#each n(3) as i (i)}
            <div class="card enquiry">
                <div class="ehead">
                    <div class="ehead-l">
                        <strong class="ename">{@render bar('130px')}</strong>
                        <span class="company">{@render bar('110px')}</span>
                    </div>
                    <div class="emeta"><small>{@render bar('120px')}</small></div>
                </div>
                <p class="email">{@render bar('190px')}</p>
                <p class="message">{@render bar('100%')}<br />{@render bar('92%')}<br />{@render bar('48%')}</p>
                <div class="actions e-actions">
                    <span class="sk reply">&nbsp;</span>
                    <span class="sk mark-btn">&nbsp;</span>
                </div>
            </div>
        {/each}

    <!-- ==================== Profile ==================== -->
    {:else if route === '/app/profile'}
        <div class="p-head">
            {@render h1('120px', '0')}
            <span class="sk btn p-edit" style:padding="10px 18px" style:font-size="13.3333px">&nbsp;</span>
        </div>
        <div class="card who">
            <span class="sk avatar"></span>
            <div class="who-text">
                <p class="who-name">{@render bar('220px')}</p>
                <p class="who-sub">{@render bar('160px')}</p>
            </div>
            <span class="sk role"></span>
        </div>
        <div class="card sect">
            <h2>{@render bar('190px')}</h2>
            <div class="rows">
                {#each n(6) as i (i)}
                    <div class="p-row">
                        <span class="dt">{@render bar('60%')}</span>
                        <span class="dd">{@render bar(`${28 + ((i * 7) % 4) * 9}%`)}</span>
                    </div>
                {/each}
            </div>
            <p class="note">{@render bar('330px')}</p>
        </div>
        <div class="card sect">
            <h2>{@render bar('90px')}</h2>
            <div class="addr">
                {#each n(4) as i (i)}<span>{@render bar(`${24 + ((i * 5) % 3) * 12}%`)}</span>{/each}
            </div>
        </div>

    <!-- ==================== Settings ==================== -->
    {:else if route?.startsWith('/app/settings')}
        {@render h1('130px')}
        {@render tabs([107, 99, 86, 86, 99, 71])}
        <div class="adm-bar">
            <div class="card adm-search">
                <input type="search" class="sk adm-search-in" disabled tabindex="-1" aria-hidden="true" />
            </div>
            <span class="sk btn" style:padding="10px 18px" style:font-size="13.3333px" style:width="150px">&nbsp;</span>
        </div>
        <div class="card adm-card">
            <table class="adm-table">
                <thead>
                    <tr>
                        <th class="chk"><span class="sk chk-box"></span></th>
                        {#each n(4) as c (c)}<th>{@render bar('56%')}</th>{/each}
                    </tr>
                </thead>
                <tbody>
                    {#each n(8) as r (r)}
                        <tr>
                            <td class="chk"><span class="sk chk-box"></span></td>
                            <td>{@render bar(`${52 + ((r * 7) % 4) * 10}%`)}</td>
                            <td>{@render bar(`${60 + ((r * 5) % 3) * 12}%`)}</td>
                            <td>{@render bar(`${44 + ((r * 3) % 4) * 12}%`)}</td>
                            <td>
                                <div class="adm-actions">
                                    <span class="sk adm-link"></span><span class="sk adm-link"></span>
                                </div>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
        {@render pager()}

    <!-- ==================== FAQ ==================== -->
    {:else if route === '/app/faq'}
        {@render h1('330px', '5px 0 6px')}
        <p class="intro">{@render bar('420px')}</p>
        <div class="faq-list">
            {#each n(6) as i (i)}
                <div class="card faq">
                    <div class="faq-q">
                        <span class="faq-t">{@render bar(`${38 + ((i * 9) % 4) * 11}%`)}</span>
                        <span class="sk chev"></span>
                    </div>
                </div>
            {/each}
        </div>

    <!-- ==================== Privacy Policy & Terms ==================== -->
    {:else if route === '/app/policy'}
        <h1>{@render bar('62%')}</h1>
        <div class="card policy">
            <h2>{@render bar('26%')}</h2>
            {#each n(3) as i (i)}
                <h3>{@render bar('30%')}</h3>
                <p>{@render bar('100%')}<br />{@render bar('96%')}<br />{@render bar('64%')}</p>
            {/each}
            <h2>{@render bar('42%')}</h2>
            {#each n(2) as i (i)}
                <h3>{@render bar('34%')}</h3>
                <p>{@render bar('100%')}<br />{@render bar('92%')}<br />{@render bar('58%')}</p>
            {/each}
        </div>

    <!-- ==================== Others (invoice / packing list converters) ==================== -->
    {:else if route === '/app/others'}
        {@render h1('100px')}
        {@render tabs([160, 140], '9px 22px', '13.3333px', '10px')}
        <p class="o-intro">{@render bar('380px')}</p>
        <div class="card o-card">
            <div class="o-drop">
                <span class="sk o-drop-ic"></span>
                <p>{@render bar('260px')}</p>
                <p class="o-sub">{@render bar('190px')}</p>
            </div>
            <span class="sk btn" style:padding="10px 18px" style:font-size="13.3333px" style:width="130px">&nbsp;</span>
        </div>

    <!-- ==================== Analytics ==================== -->
    {:else if ANALYTICS_ROUTES.includes(route)}
        {@render h1('140px', '5px 0 10px')}
        <label class="picker"><select class="sk" disabled tabindex="-1" aria-hidden="true"></select></label>

        {#if analyticsPage === '/app/analytics/customer-requests'}
            <div class="cr-stats">
                {#each n(4) as i (i)}
                    <div class="card cr-stat">
                        <span class="cr-l">{@render bar('62%')}</span>
                        <span class="cr-v">{@render bar('36%')}</span>
                        <span class="cr-s">{@render bar('56%')}</span>
                    </div>
                {/each}
            </div>
            <div class="card section">
                <h2>{@render bar('250px')}</h2>
                <div class="sk split"></div>
                <div class="legend"><span>{@render bar('90px')}</span><span>{@render bar('100px')}</span></div>
            </div>
            <div class="card section">
                <h2>{@render bar('230px')}</h2>
                <div class="aging-stats">
                    {#each n(3) as i (i)}
                        <div class="ag">
                            <span class="ag-n">{@render bar('30%')}</span>
                            <span class="ag-l">{@render bar('72%')}</span>
                        </div>
                    {/each}
                </div>
                <ol class="aging-list">
                    {#each n(3) as i (i)}
                        <li class="ag-row"><span class="ag-num"></span><span>{@render bar('34%')}</span><span class="sk ag-sla"></span></li>
                    {/each}
                </ol>
            </div>
            <div class="grid2">
                {#each n(4) as k (k)}
                    <div class="card section">
                        <h2>{@render bar('62%')}</h2>
                        {@render barRows(5)}
                        <p class="hint">{@render bar('84%')}</p>
                    </div>
                {/each}
            </div>

        {:else if analyticsPage === '/app/analytics/user-activities'}
            <div class="card section">
                <h2>{@render bar('330px')}</h2>
                <div class="ua-stats">
                    {#each n(5) as i (i)}
                        <div class="ua">
                            <span class="ua-n">{@render bar('40%')}</span>
                            <span class="ua-l">{@render bar('76%')}</span>
                        </div>
                    {/each}
                </div>
                <h3 class="ua-sub">{@render bar('250px')}</h3>
                <div class="spark">{#each n(14) as i (i)}<span class="sk spark-bar" style:height={`${34 + ((i * 17) % 9) * 7}%`}></span>{/each}</div>
            </div>
            <div class="grid2">
                {#each n(2) as k (k)}
                    <div class="card section">
                        <h2>{@render bar('52%')}</h2>
                        {@render barRows(6)}
                    </div>
                {/each}
            </div>
            <div class="card section">
                <h2>{@render bar('230px')}</h2>
                <p class="hint ua-hint">{@render bar('300px')}</p>
                <div class="sk ua-chart"></div>
            </div>
            <div class="grid2">
                {#each n(2) as k (k)}
                    <div class="card section">
                        <h2>{@render bar('44%')}</h2>
                        <p class="hint ua-hint">{@render bar('70%')}</p>
                        {@render barRows(4)}
                    </div>
                {/each}
            </div>

        {:else if analyticsPage === '/app/analytics/forecasts'}
            <section class="wrap">
                <header>
                    <h2 class="fc-h2">{@render bar('330px')}</h2>
                    <p class="fc-sub">{@render bar('330px')}</p>
                    <div class="fc-legend">
                        <span>{@render bar('170px')}</span><span>{@render bar('110px')}</span><span>{@render bar('60px')}</span>
                    </div>
                </header>
                {#each n(2) as g (g)}
                    <div class="fc-project">
                        <h3 class="fc-h3">{@render bar('170px')}</h3>
                        <table class="fc-table">
                            <thead>
                                <tr>{#each n(6) as c (c)}<th>{@render bar('60%')}</th>{/each}</tr>
                            </thead>
                            <tbody>
                                {#each n(4) as r (r)}
                                    <tr>
                                        <td class="fc-part">
                                            <span class="fc-pn">{@render bar('70%')}</span>
                                            <span class="fc-nm">{@render bar('50%')}</span>
                                        </td>
                                        <td class="num">{@render bar('56%')}</td>
                                        <td class="chart-col"><span class="sk fc-chart"></span></td>
                                        <td class="num">{@render bar('40%')}</td>
                                        <td class="num">{@render bar('60%')}</td>
                                        <td class="num">{@render bar('62%')}</td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                {/each}
            </section>

        {:else if analyticsPage === '/app/analytics/suggestions'}
            <p class="an-intro an-intro-18">{@render bar('100%')}<br />{@render bar('62%')}</p>
            {@render searchFilter()}
            {@render tabs([172, 176, 96], '9px 22px', '14px')}
            <div class="rows">
                {#each n(3) as i (i)}
                    <div class="card sg-row">
                        <div class="meta">
                            <span class="sk chip"></span><span>{@render bar('90px')}</span><span class="sk chip"></span><span class="sk chip wide"></span>
                        </div>
                        <p class="query">{@render bar('84%')}</p>
                        <div class="suggested"><span>{@render bar('120px')}</span><strong>{@render bar('110px')}</strong></div>
                        <div class="sg-actions">
                            {@render btn('110px', '8px 14px', '13.3333px', '1px')}
                            {@render btn('96px', '8px 14px', '13.3333px', '1px')}
                            {@render btn('120px', '8px 14px', '13.3333px', '1px')}
                        </div>
                    </div>
                {/each}
            </div>

        {:else if analyticsPage === '/app/analytics/training-data'}
            <p class="an-intro">{@render bar('100%')}<br />{@render bar('54%')}</p>
            <div class="card baseline">
                <div class="bl-main">{@render bar('340px')}</div>
                <p class="bl-note">{@render bar('100%')}<br />{@render bar('46%')}</p>
            </div>
            <h2 class="td-h2">{@render bar('150px')}</h2>
            <div class="td-stats">
                {#each n(4) as i (i)}
                    <div class="card an-stat">
                        <span class="an-v">{@render bar('34%')}</span>
                        <span class="an-l">{@render bar('62%')}</span>
                        <span class="an-s">{@render bar('84%')}</span>
                    </div>
                {/each}
            </div>
            <div class="nudges">
                {#each n(2) as i (i)}
                    <div class="card nudge">
                        <div class="nudge-body"><p>{@render bar('100%')}<br />{@render bar('64%')}</p></div>
                        <span class="sk nudge-cta">&nbsp;</span>
                    </div>
                {/each}
            </div>

        {:else if analyticsPage === '/app/analytics/service-records'}
            <p class="an-intro an-intro-16">{@render bar('100%')}<br />{@render bar('50%')}</p>
            {@render searchFilter()}
            <span class="sk btn sr-add" style:padding="10px 18px" style:font-size="13.3333px" style:width="140px">&nbsp;</span>
            <div class="card table-wrap sr-wrap">
                {@render dataTable(7, 8, 3, '0.5rem 0.6rem')}
            </div>

        {:else if analyticsPage === '/app/analytics/email-log'}
            <p class="an-intro">{@render bar('100%')}<br />{@render bar('58%')}</p>
            <div class="an-stats">
                {#each n(3) as i (i)}
                    <div class="card an-stat">
                        <span class="an-v">{@render bar('30%')}</span>
                        <span class="an-l">{@render bar('62%')}</span>
                        <span class="an-s">{@render bar('76%')}</span>
                    </div>
                {/each}
            </div>
            {@render searchFilter()}
            {@render tabs([142, 112], '9px 22px', '14px')}
            <div class="card table-wrap">
                {@render dataTable(5, 8, 4)}
            </div>

        {:else}
            <!-- audit log -->
            <p class="an-intro">{@render bar('100%')}<br />{@render bar('72%')}</p>
            <div class="an-stats">
                {#each n(3) as i (i)}
                    <div class="card an-stat">
                        <span class="an-v">{@render bar('30%')}</span>
                        <span class="an-l">{@render bar('62%')}</span>
                        <span class="an-s">{@render bar('76%')}</span>
                    </div>
                {/each}
            </div>
            {@render searchFilter()}
            {@render tabs([84, 124, 120, 136, 116], '9px 22px', '14px')}
            <div class="card table-wrap">
                {@render dataTable(4, 8, 3)}
            </div>
        {/if}

    {:else}
        {@render h1('190px')}
        {#each n(4) as i (i)}<div class="card generic"><span class="sk generic-in"></span></div>{/each}
    {/if}
</div>

<style>
    .skw {
        animation: skFade 160ms ease both;
    }

    /* ---------- shimmer ---------- */
    .sk,
    .t {
        background: linear-gradient(90deg, #dde3ea 25%, #eef2f6 37%, #dde3ea 63%);
        background-size: 400% 100%;
        animation: skShimmer 1.3s ease infinite;
    }

    :global(:root[data-theme='dark']) .sk,
    :global(:root[data-theme='dark']) .t {
        background: linear-gradient(90deg, #26374b 25%, #3a556f 37%, #26374b 63%);
        background-size: 400% 100%;
    }

    .sk {
        border-radius: 8px;
    }

    .t {
        display: inline-block;
        vertical-align: top;
        max-width: 100%;
        border-radius: 5px;
        color: transparent;
        user-select: none;
    }

    /* disabled real controls, painted as a shimmer block */
    .box,
    .search,
    .adm-search-in,
    .sub-select,
    .picker select {
        border-color: transparent;
        color: transparent;
        opacity: 1;
        cursor: default;
    }

    .box:disabled {
        -webkit-text-fill-color: transparent;
    }

    .box::-webkit-calendar-picker-indicator {
        opacity: 0;
    }

    textarea.box {
        resize: none;
    }

    .btn {
        display: inline-block;
        border: 0 solid transparent;
        color: transparent;
        line-height: normal;
        vertical-align: top;
    }

    .tabbar {
        display: inline-flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .tab {
        display: inline-block;
        border: 1px solid transparent;
        color: transparent;
    }

    /* ---------- search & filter bar (SearchFilter.svelte) ---------- */
    .filters {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 12px;
        padding: 14px 16px;
        margin-bottom: 18px;
    }

    .f-search {
        flex: 1 1 220px;
        min-width: 180px;
    }

    .f {
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 158px;
    }

    .f-lbl {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.02em;
    }

    /* ---------- pagination ---------- */
    .pager {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: 12px;
        flex-wrap: wrap;
    }

    .pager-info {
        font-size: 13px;
    }

    .pager-btns {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-left: auto;
    }

    .pg-btn {
        min-width: 38px;
        height: 38px;
    }

    .block :global(.pager) {
        margin-top: 16px;
    }

    /* ---------- home page ---------- */
    .layout {
        display: grid;
        grid-template-columns: 280px 1fr;
        gap: 10px;
        align-items: stretch;
        min-height: 63vh;
    }

    .sidebar {
        padding: 16px;
        height: 100%;
    }

    .expand-all {
        display: none;
        width: 100%;
        margin-bottom: 10px;
        padding: 10px 12px;
        border: 1px solid transparent;
        font-size: 14px;
        color: transparent;
    }

    .search-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 14px;
    }

    .search {
        flex: 1;
        min-width: 0;
        margin: 0;
    }

    .collapse-btn {
        flex: 0 0 auto;
        width: 40px;
        height: 40px;
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
    }

    .proj-head {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 9px 10px;
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

    .proj-sub {
        font-size: 12px;
        display: block;
    }

    .content {
        min-width: 0;
        display: flex;
        flex-direction: column;
    }

    .empty {
        position: relative;
        overflow: hidden;
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        padding: 36px 48px;
        text-align: center;
    }

    .empty-bp {
        width: min(100%, 700px);
        height: 240px;
        border-radius: 12px;
        opacity: 0.55;
    }

    .empty-text {
        margin-top: 30px;
    }

    .empty-text h2 {
        margin: 0 0 6px;
    }

    .empty-text p {
        margin: 0;
    }

    .home-tabbar {
        display: inline-flex;
        gap: 8px;
        margin-bottom: 18px;
    }

    .home-tab {
        display: inline-block;
        padding: 9px 22px;
        border: 1px solid transparent;
        font-size: 16px;
        color: transparent;
    }

    .title {
        margin: 0 0 6px;
        font-size: 22px;
    }

    .desc {
        margin: 0 0 16px;
        max-width: 60ch;
    }

    .desc.parts-desc {
        margin-bottom: 20px;
    }

    .subtabs {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 18px;
    }

    .stab {
        display: inline-block;
        padding: 8px 18px;
        border: 1px solid transparent;
        font-size: 12.5px;
        color: transparent;
    }

    .sub-select {
        display: none;
        width: 100%;
        margin: 0 0 18px;
        padding: 11px 13px;
        font-size: 14px;
        font-weight: 700;
        appearance: none;
    }

    .design-card {
        padding: 16px 18px;
        margin-bottom: 20px;
    }

    .design-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
        flex-wrap: wrap;
    }

    .design-head .dh-title {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
    }

    .live-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
    }

    .hint,
    .dh-hint {
        font-size: 12px;
    }

    .design-head .hint,
    .design-head .dh-hint {
        display: block;
        min-width: 0;
        max-width: 100%;
    }

    .design {
        padding: 16px;
    }

    .design .design-head {
        gap: 6px 12px;
    }

    .b3d {
        width: 100%;
        height: 540px;
        border-radius: 12px;
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 14px;
    }

    .spec {
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        border-left: 3px solid transparent;
    }

    .k {
        font-size: 11.5px;
        letter-spacing: 0.04em;
    }

    .v {
        font-size: 18px;
        font-weight: 700;
    }

    /* spare parts explorer */
    .explorer {
        --pf-h: 650px;
        --b3d-h: var(--pf-h);
        display: grid;
        grid-template-columns: minmax(0, 1fr) 380px;
        gap: 14px;
        align-items: stretch;
    }

    .explorer .stage {
        min-width: 0;
        height: var(--b3d-h);
        border-radius: 12px;
    }

    .pf {
        height: var(--pf-h);
        min-width: 0;
        display: flex;
        flex-direction: column;
        border: 1px solid var(--bme-border);
        border-radius: 12px;
        background: var(--bme-surface);
        overflow: hidden;
    }

    .pf-top {
        padding: 12px 12px 10px;
        border-bottom: 1px solid var(--bme-border);
        background: var(--bme-surface-2);
    }

    .crumbs {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        margin: 0 0 8px;
        font-size: 12.5px;
        font-weight: 600;
    }

    .crumb {
        padding: 2px 4px;
    }

    .searchbox {
        height: 40px;
        border-radius: 9px;
    }

    .pf-body {
        flex: 1;
        min-height: 0;
        overflow: hidden;
        padding: 12px;
    }

    .head {
        margin: 0 0 10px;
    }

    .head h3 {
        margin: 0 0 3px;
        font-size: 17px;
    }

    .head p {
        margin: 0;
        font-size: 12.5px;
    }

    .list {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 7px;
    }

    .row {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 11px 10px 11px 11px;
        border: 1px solid var(--bme-border);
        border-radius: 9px;
    }

    .row-bar {
        width: 5px;
        align-self: stretch;
        border-radius: 3px;
        flex: none;
    }

    .tx {
        flex: 1;
        min-width: 0;
    }

    .tx b {
        display: block;
        font-size: 14.5px;
        line-height: 1.25;
    }

    .meta {
        display: block;
        margin-top: 3px;
        font-size: 12px;
    }

    .chev {
        flex: none;
        width: 18px;
        height: 18px;
        border-radius: 4px;
    }

    /* ---------- cart list ---------- */
    .q-list {
        padding: 8px 18px 18px;
        margin-bottom: 18px;
    }

    .q-row {
        display: grid;
        grid-template-columns: 2fr 0.9fr 0.8fr 40px;
        align-items: center;
        gap: 12px;
        padding: 14px 0;
        border-bottom: 1px solid var(--bme-border);
    }

    .q-row.q-head {
        font-size: 12px;
        font-weight: 700;
    }

    .q-part {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
    }

    .q-thumb {
        flex: 0 0 64px;
        width: 64px;
        height: 64px;
        border-radius: 8px;
    }

    .q-ptext {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    .q-ptext small {
        font-size: 12.8px;
    }

    .q-qty {
        width: 70px;
    }

    .q-x-btn {
        display: inline-block;
        padding: 4px 8px;
        font-size: 16px;
        width: 32px;
        color: transparent;
    }

    .q-notes {
        padding: 18px;
        margin-bottom: 18px;
    }

    .q-label {
        display: block;
    }

    .q-label-t {
        display: block;
        font-weight: 600;
        margin-bottom: 8px;
    }

    .q-attach {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--bme-border);
    }

    .q-attach-hint {
        font-size: 12.8px;
    }

    .q-submit {
        display: flex;
        justify-content: flex-end;
        margin-top: 10px;
    }

    /* ---------- requests / history cards ---------- */
    .quote {
        padding: 20px;
        margin-bottom: 16px;
    }

    .qhead {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }

    .qhead-l {
        display: flex;
        align-items: center;
    }

    .ref {
        font-size: 18px;
    }

    .status-pill {
        display: inline-block;
        width: 64px;
        height: 22px;
        margin-left: 10px;
        border-radius: 999px;
    }

    .qdate {
        font-size: 13.3333px;
    }

    .timeline {
        margin: 4px 0 14px;
    }

    .timeline ol {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        align-items: flex-start;
    }

    .timeline li {
        flex: 1 1 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 4px;
        min-width: 0;
    }

    .dot {
        width: 24px;
        height: 24px;
        border-radius: 50%;
    }

    .tl-label {
        width: 100%;
        font-size: 13px;
        font-weight: 600;
    }

    .tl-at {
        width: 100%;
        font-size: 12px;
    }

    .customer {
        margin-bottom: 14px;
        font-size: 14px;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .customer.tight {
        gap: 4px;
    }

    .customer p {
        margin: 0;
    }

    .qt {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
    }

    .qt th {
        text-align: center;
        font-size: 12px;
        padding: 6px 8px;
    }

    .qt td {
        text-align: center;
        padding: 8px;
        border-top: 1px solid var(--bme-border);
    }

    .qt td.left {
        text-align: left;
    }

    .action-field {
        display: block;
        margin-top: 16px;
    }

    .field-label {
        margin: 0 0 6px;
        font-size: 13px;
        font-weight: 600;
    }

    .field-help {
        display: block;
        margin-top: 4px;
        font-size: 12px;
    }

    .actions {
        display: flex;
        gap: 10px;
        margin-top: 14px;
    }

    .h-timeline {
        margin-top: 16px;
        padding: 12px 14px;
        background-color: var(--bme-surface-2);
        border: 1px solid var(--bme-border);
        border-radius: 8px;
    }

    .tl-title {
        display: block;
        font-size: 12px;
        letter-spacing: 0.02em;
        margin-bottom: 10px;
    }

    .tl-row {
        padding-left: 12px;
        border-left: 2px solid var(--bme-border);
        margin-bottom: 12px;
    }

    .tl-when {
        margin: 0 0 2px;
        font-size: 12.5px;
    }

    .tl-line {
        margin: 0;
        font-size: 14px;
    }

    .add-btn {
        display: inline-block;
        margin-top: 4px;
        padding: 7px 14px;
        border: 1px solid transparent;
        font-size: 13px;
        color: transparent;
    }

    .reopen-btn {
        display: inline-block;
        margin-top: 14px;
        padding: 8px 18px;
        border: 1px solid transparent;
        font-size: 13.5px;
        color: transparent;
    }

    /* ---------- enquiries ---------- */
    .enquiry {
        padding: 18px 20px;
        margin-bottom: 14px;
    }

    .ehead {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
        margin-bottom: 6px;
    }

    .ename {
        font-size: 16px;
    }

    .company {
        margin-left: 10px;
        font-size: 13px;
    }

    .emeta {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
        flex: 0 0 auto;
    }

    .ehead small {
        font-size: 12.5px;
    }

    .email {
        display: block;
        margin: 0;
        font-size: 13.5px;
        font-weight: 600;
    }

    .message {
        margin: 12px 0;
        font-size: 14px;
        line-height: 1.55;
    }

    .e-actions {
        margin-top: 14px;
        padding-top: 10px;
        align-items: center;
        flex-wrap: wrap;
    }

    .reply {
        display: inline-flex;
        width: 62px;
        padding: 8px 12px;
        font-size: 14px;
        color: transparent;
    }

    .mark-btn {
        display: inline-flex;
        width: 128px;
        padding: 8px 12px;
        border: 1px solid transparent;
        font-size: 16px;
        color: transparent;
    }

    /* ---------- profile ---------- */
    .p-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 18px;
    }

    .p-edit {
        width: 126px;
    }

    .who {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
        padding: 20px;
        margin-bottom: 16px;
    }

    .avatar {
        flex: 0 0 auto;
        width: 58px;
        height: 58px;
        border-radius: 50%;
    }

    .who-text {
        flex: 1 1 auto;
        min-width: 0;
    }

    .who-name {
        margin: 0;
        font-size: 19px;
        font-weight: 700;
    }

    .who-sub {
        margin: 2px 0 0;
        font-size: 14px;
    }

    .role {
        width: 92px;
        height: 25px;
        border-radius: 999px;
    }

    .sect {
        padding: 20px;
        margin-bottom: 16px;
    }

    .sect h2 {
        margin: 0 0 14px;
        font-size: 16px;
    }

    .rows {
        margin: 0;
    }

    .p-row {
        display: grid;
        grid-template-columns: 180px 1fr;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid var(--bme-border);
    }

    .p-row:last-child {
        border-bottom: none;
    }

    .p-row .dt {
        font-size: 13.5px;
        font-weight: 600;
    }

    .note {
        margin: 12px 0 0;
        font-size: 12.5px;
    }

    .addr {
        display: flex;
        flex-direction: column;
        gap: 2px;
        line-height: 1.6;
    }

    /* ---------- settings (admin tables) ---------- */
    .adm-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 14px;
    }

    .adm-search {
        width: 280px;
        padding: 0;
        border-radius: 10px;
    }

    .adm-search-in {
        width: 100%;
        padding: 11px 14px 11px 36px;
        border: none;
        border-radius: 10px;
    }

    .adm-card {
        padding: 14px;
        overflow: hidden;
    }

    .adm-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
    }

    .adm-table th {
        text-align: center;
        font-size: 12px;
        padding: 8px;
        border-bottom: 1px solid var(--bme-border);
    }

    .adm-table td {
        padding: 10px 8px;
        border-bottom: 1px solid var(--bme-border);
        vertical-align: middle;
        text-align: center;
    }

    .adm-table .chk {
        width: 40px;
        text-align: center;
    }

    .chk-box {
        display: inline-block;
        width: 16px;
        height: 16px;
        border-radius: 4px;
        vertical-align: middle;
    }

    .adm-actions {
        display: flex;
        justify-content: center;
        gap: 8px;
    }

    .adm-link {
        display: inline-block;
        width: 62px;
        height: 32px;
        border-radius: 5px;
    }

    /* ---------- faq ---------- */
    .intro {
        margin: 0 0 18px;
        font-size: 14px;
    }

    .faq-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .faq {
        padding: 0;
        overflow: hidden;
    }

    .faq-q {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 18px;
        font-size: 15px;
        font-weight: 600;
    }

    .faq-t {
        flex: 1;
        min-width: 0;
    }

    /* ---------- policy ---------- */
    .policy {
        padding: 0 20px;
    }

    /* ---------- others ---------- */
    .o-intro {
        margin: 10px 0 20px;
        font-size: 0.85rem;
    }

    .o-card {
        padding: 20px;
    }

    .o-drop {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 34px 20px;
        margin-bottom: 16px;
        border: 2px dashed var(--bme-border);
        border-radius: 10px;
        text-align: center;
    }

    .o-drop p {
        margin: 0;
    }

    .o-drop-ic {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        margin-bottom: 6px;
    }

    .o-sub {
        font-size: 13px;
    }

    /* ---------- analytics (shared) ---------- */
    .picker {
        display: block;
        width: 180px;
        max-width: 100%;
        margin-bottom: 20px;
    }

    .section {
        padding: 18px 20px;
        margin: 0 0 4px;
    }

    .section h2 {
        margin-top: 5px;
    }

    .grid2 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        margin: 0 0 4px;
        gap: 5px;
    }

    .grid2 .section {
        margin-bottom: 0;
    }

    .hint {
        margin: 10px 0 0;
        font-size: 13px;
    }

    .bars {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .bar-row {
        display: grid;
        grid-template-columns: 90px 1fr auto;
        align-items: center;
        gap: 12px;
    }

    .bar-key {
        font-size: 14px;
        font-weight: 600;
    }

    .track {
        height: 14px;
        border-radius: 999px;
    }

    .bar-val {
        font-size: 13px;
        font-weight: 700;
    }

    /* customer requests */
    .cr-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
        margin-bottom: 18px;
    }

    .cr-stat {
        padding: 16px 18px;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .cr-l {
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.02em;
    }

    .cr-v {
        font-size: 30px;
        font-weight: 700;
        line-height: 1.1;
    }

    .cr-s {
        font-size: 12px;
    }

    .split {
        display: flex;
        height: 22px;
        width: 100%;
        border-radius: 6px;
        margin: 10px 0 12px;
    }

    .legend {
        display: flex;
        gap: 18px;
        font-size: 13px;
    }

    .aging-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin: 12px 0 16px;
    }

    .ag {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px 14px;
        border-radius: 10px;
        border-top: 4px solid var(--bme-border);
        background: var(--bme-surface-2);
    }

    .ag-n {
        font-size: 24px;
        font-weight: 700;
        line-height: 1.15;
    }

    .ag-l {
        font-size: 12.5px;
    }

    .aging-list {
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .ag-row {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 12px;
        padding: 10px 0;
        border-top: 1px solid var(--bme-border);
    }

    .ag-num {
        min-width: 20px;
    }

    .ag-sla {
        width: 84px;
        height: 22px;
        border-radius: 999px;
    }

    /* user activities */
    .ua-stats {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 12px;
        margin-bottom: 22px;
    }

    .ua {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px 14px;
        border-radius: 10px;
        border-top: 4px solid var(--bme-border);
        background: var(--bme-surface-2);
    }

    .ua-n {
        font-size: 24px;
        font-weight: 700;
        line-height: 1.15;
    }

    .ua-l {
        font-size: 12.5px;
    }

    .ua-sub {
        margin: 4px 0 12px;
        font-size: 16px;
    }

    .spark {
        display: flex;
        align-items: flex-end;
        gap: 6px;
        height: 150px;
    }

    .spark-bar {
        flex: 1;
        border-radius: 4px 4px 0 0;
    }

    .ua-hint {
        margin: 0 0 14px;
    }

    .ua-chart {
        height: 200px;
        border-radius: 8px;
    }

    /* forecasts */
    .wrap {
        max-width: 100%;
        margin: 0 auto;
        padding: 1.5rem;
        background-color: var(--bme-surface);
    }

    .fc-h2 {
        margin: 0;
        font-size: 1.4rem;
    }

    .fc-sub {
        margin: 0.25rem 0 0.75rem;
        font-size: 0.85rem;
    }

    .fc-legend {
        display: flex;
        gap: 1.1rem;
        flex-wrap: wrap;
        margin-bottom: 1.5rem;
        font-size: 0.75rem;
    }

    .fc-project {
        margin-bottom: 1.75rem;
    }

    .fc-h3 {
        font-size: 1rem;
        border-bottom: 2px solid var(--bme-border);
        padding-bottom: 0.3rem;
    }

    .fc-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
    }

    .fc-table th,
    .fc-table td {
        text-align: left;
        padding: 0.5rem 0.6rem;
        border-bottom: 1px solid var(--bme-border);
        vertical-align: middle;
    }

    .fc-table .num {
        text-align: center;
    }

    .fc-part {
        width: 26%;
    }

    .fc-pn {
        display: block;
    }

    .fc-nm {
        display: block;
        font-size: 0.8rem;
    }

    .chart-col {
        width: 20%;
        text-align: center;
    }

    .fc-chart {
        display: inline-block;
        width: 100%;
        height: 34px;
        border-radius: 6px;
        vertical-align: middle;
    }

    /* suggestions */
    .an-intro {
        margin: 0 0 20px;
        font-size: 0.85rem;
        line-height: 1.5;
    }

    .an-intro-18 {
        margin-bottom: 18px;
    }

    .an-intro-16 {
        margin-bottom: 1rem;
    }

    .rows {
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .sg-row {
        padding: 18px 20px;
    }

    .meta {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        font-size: 0.72rem;
        margin-bottom: 10px;
    }

    .chip {
        display: inline-block;
        width: 64px;
        height: 20px;
        border-radius: 999px;
    }

    .chip.wide {
        width: 84px;
    }

    .query {
        margin: 0 0 10px;
    }

    .suggested {
        display: flex;
        align-items: baseline;
        gap: 10px;
        padding: 10px 12px;
        background: var(--bme-surface-2);
        border-radius: 8px;
    }

    .sg-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 12px;
    }

    /* training data */
    .baseline {
        border-left: 4px solid var(--bme-border);
        padding: 18px;
    }

    .bl-main {
        font-size: 0.85rem;
    }

    .bl-note {
        font-size: 0.8rem;
        line-height: 1.5;
        margin: 10px 0 0;
    }

    .td-h2 {
        font-size: 1rem;
        margin: 1.75rem 0 0.75rem;
    }

    .td-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
    }

    .an-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-bottom: 20px;
    }

    .an-stat {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 18px 20px;
    }

    .an-v {
        font-size: 1.6rem;
        font-weight: 700;
        line-height: 1.1;
    }

    .an-l {
        font-size: 0.85rem;
        font-weight: 600;
    }

    .an-s {
        font-size: 0.75rem;
    }

    .nudges {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 14px;
    }

    .nudge {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        flex-wrap: wrap;
        border-left: 4px solid var(--bme-border);
        padding: 14px 20px;
    }

    .nudge-body {
        flex: 1;
        min-width: 220px;
    }

    .nudge p {
        margin: 0;
        font-size: 0.85rem;
        line-height: 1.5;
    }

    .nudge-cta {
        flex: 0 0 auto;
        display: inline-block;
        width: 124px;
        padding: 7px 16px;
        font-size: 0.83rem;
        color: transparent;
    }

    /* tables */
    .table-wrap {
        padding: 6px 14px;
        overflow-x: auto;
        margin-bottom: 14px;
    }

    .table-wrap.sr-wrap {
        padding: 0;
        margin-bottom: 0;
    }

    .sr-add {
        display: flex;
        margin: 10px 0;
    }

    .dt {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.87rem;
    }

    .dt th {
        text-align: left;
        padding: var(--cell-pad, 0.7rem);
        border-bottom: 1px solid var(--bme-border);
        font-size: 0.78rem;
        letter-spacing: 0.02em;
        white-space: nowrap;
    }

    .dt td {
        text-align: left;
        padding: var(--cell-pad, 0.7rem);
        border-bottom: 1px solid var(--bme-border);
        vertical-align: top;
    }

    .dt tbody tr:last-child td {
        border-bottom: none;
    }

    .td-sub {
        display: block;
        font-size: 0.78rem;
    }

    /* fallback */
    .generic {
        padding: 18px;
        margin-bottom: 14px;
    }

    .generic-in {
        display: block;
        height: 40px;
    }

    @keyframes skShimmer {
        0% { background-position: 100% 0; }
        100% { background-position: -100% 0; }
    }

    @keyframes skFade {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    /* ---------- breakpoints, matching the real pages ---------- */
    @media (max-width: 1180px) {
        .explorer {
            grid-template-columns: minmax(0, 1fr) 340px;
        }
    }

    @media (max-width: 1100px) {
        .ua-stats {
            grid-template-columns: repeat(3, 1fr);
        }
    }

    @media (max-width: 900px) {
        .b3d {
            height: 460px;
        }
    }

    @media (max-width: 860px) {
        .layout {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr;
            min-height: 0;
        }

        .sidebar {
            height: fit-content;
        }

        /* on small screens the project list starts collapsed behind the Expand All button */
        .expand-all {
            display: block;
        }

        .collapse-btn,
        .project-groups {
            display: none;
        }

        .empty {
            min-height: 380px;
            padding: 28px 20px;
        }

        .explorer {
            --b3d-h: 420px;
            grid-template-columns: 1fr;
        }

        .pf {
            height: auto;
            max-height: 78vh;
        }

        .grid2 {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 720px) {
        .q-row {
            grid-template-columns: 1fr auto;
            gap: 4px 12px;
            padding-right: 28px;
        }

        .q-row.q-head {
            display: none;
        }

        .q-row .q-part {
            grid-column: 1 / -1;
        }

        .cr-stats {
            grid-template-columns: repeat(2, 1fr);
        }

        .ua-stats {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    @media (max-width: 640px) {
        .subtabs {
            display: none;
        }

        .sub-select {
            display: block;
        }

        .grid {
            grid-template-columns: repeat(2, 1fr);
        }

        .tabbar {
            width: 100%;
        }

        .tabbar .tab {
            flex: 1;
        }

        .home-tabbar {
            width: 100%;
            justify-content: space-between;
        }

        .home-tab {
            width: 48% !important;
        }

        .filters {
            gap: 10px;
        }

        .f,
        .f-search {
            flex: 1 1 100%;
            width: auto;
        }

        .quote {
            padding: 16px;
        }

        .qhead {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
        }

        .qt {
            font-size: 13px;
        }

        .qt th,
        .qt td {
            padding: 6px;
        }

        .enquiry {
            padding: 16px;
        }

        .ehead {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
        }

        .emeta {
            align-items: flex-start;
        }

        .p-row {
            grid-template-columns: 1fr;
            gap: 2px;
        }

        .adm-search {
            width: 100%;
        }

        .faq-q {
            padding: 14px 16px;
            font-size: 14.5px;
        }

        .aging-stats {
            grid-template-columns: 1fr 1fr;
        }

        .dt,
        .qt {
            display: block;
            overflow-x: auto;
            white-space: nowrap;
        }
    }

    @media (max-width: 560px) {
        .design {
            padding: 12px;
        }

        .explorer {
            --b3d-h: 340px;
            gap: 10px;
        }

        .b3d {
            height: 380px;
        }

        .sr-add {
            justify-content: center;
        }
    }

    @media (max-width: 480px) {
        .picker {
            width: 100%;
        }

        .cr-stats {
            gap: 6px;
        }

        .cr-stat {
            padding: 10px 7px;
        }

        .cr-l {
            font-size: 9.5px;
            letter-spacing: 0;
        }

        .cr-v {
            font-size: 18px;
        }

        .cr-s {
            font-size: 10px;
        }

        .bar-row {
            grid-template-columns: 76px 1fr auto;
            gap: 8px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .sk,
        .t {
            animation-duration: 2.4s;
        }
    }
</style>