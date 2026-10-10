(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const dataset = JSON.parse(byId('inventory-data').textContent);
  const rows = dataset.properties;
  const families = {plumbing:'Plumbing',checkout_cleaning:'Cleaning',checkout_refurbishment:'Refurbishment',appliance:'Appliances',doors_locks:'Doors and locks',garden:'Garden',inspection:'Inspection',windows:'Windows'};
  const groups = {scope:'Scope unconfirmed',documents:'Missing documents',chronology:'Chronology needs review',identity:'Property or identity questions',permission:'Permission or approval questions',communication:'Communication needs review',other:'Other evidence questions'};
  const kinds = {reported_issue:'Reported issue',recorded_work:'Recorded work',follow_up:'Follow-up matter'};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const unique = items => [...new Map(items.map(item => [JSON.stringify(item), item])).values()];
  const tagsFor = row => [...new Set(row.review_guidance.question_groups.flatMap(group => group.tags))];
  const search = byId('search'), family = byId('family'), gap = byId('question-filter'), sort = byId('sort');
  const list = byId('property-list'), detail = byId('detail');
  const params = new URLSearchParams(location.hash.slice(1));
  let selected = params.get('case') || rows[0]?.case_id;
  let activeTab = 'summary', view = params.get('view') === 'list' ? 'list' : 'map', shown = [];

  family.innerHTML += [...new Set(rows.map(row => row.family))].sort((a,b) => families[a].localeCompare(families[b])).map(key => `<option value="${esc(key)}">${esc(families[key])}</option>`).join('');
  gap.innerHTML += Object.entries(groups).map(([key,label]) => {
    const count = rows.filter(row => tagsFor(row).includes(key)).length;
    return count ? `<option value="${key}">${esc(label)} (${count})</option>` : '';
  }).join('');
  search.value = params.get('search') || '';
  family.value = params.get('type') || '';
  gap.value = params.get('gap') || '';
  sort.value = ['case','issues','questions'].includes(params.get('sort')) ? params.get('sort') : 'case';
  byId('property-total').textContent = rows.length;
  byId('issue-total').textContent = rows.reduce((n,row) => n + row.issues.length, 0);
  byId('question-total').textContent = rows.reduce((n,row) => n + row.caveats.length, 0);
  byId('source-revision').textContent = dataset.source_revision.slice(0,7);

  function saveView() {
    const state = new URLSearchParams();
    if (selected) state.set('case',selected);
    state.set('view',view);
    if (search.value) state.set('search',search.value);
    if (family.value) state.set('type',family.value);
    if (gap.value) state.set('gap',gap.value);
    if (sort.value !== 'case') state.set('sort',sort.value);
    history.replaceState(null,'','#' + state.toString());
  }
  function quotes(items,row) {
    return unique(items).map(item => `<blockquote class="quote"><p>“${esc(item.quote)}”</p><a href="${esc(row.source_url + '/' + item.file + (item.event ? '#' + item.event : ''))}" target="_blank" rel="noopener noreferrer">${item.event ? 'History ' + esc(item.event.replace('event-','event ')) : 'Case summary'} · ${esc(row.case_id)}</a></blockquote>`).join('');
  }
  function evidence(items,row,label) {
    return `<details class="evidence"><summary>Source evidence: ${esc(label)} (${unique(items).length})</summary>${quotes(items,row)}</details>`;
  }
  function switchTab(tab,target) {
    activeTab = tab;
    renderDetail();
    const destination = target ? byId(target) : byId('panel-' + tab);
    if (target && destination) destination.setAttribute('tabindex','-1');
    destination?.focus({preventScroll:true});
    destination?.scrollIntoView({block:'start'});
  }
  function renderDetail() {
    const row = rows.find(item => item.case_id === selected);
    if (!row) {
      detail.innerHTML = '<div class="empty"><h2>No matching properties</h2><p>Change the search or evidence filter, or clear the filters to return to the sample.</p><button class="quiet-button" id="empty-clear" type="button">Clear filters</button></div>';
      byId('empty-clear').addEventListener('click',clearFilters);
      return;
    }
    const guidance = row.review_guidance;
    const next = guidance.next_check;
    const tabs = [['summary','Summary'],['questions',`Questions (${row.caveats.length})`],['evidence','Evidence']];
    detail.innerHTML = `<div class="panel-toolbar"><span class="eyebrow">Selected property · Case ${esc(row.case_id)}</span><button class="primary-button" id="view-evidence" type="button">View evidence</button></div><div class="detail-body">
      <h2>${esc(row.property)}</h2><p class="property-context">${esc(families[row.family])} · ${row.issues.length} recorded item${row.issues.length === 1 ? '' : 's'}<br>Synthetic address · actual location and property identity unverified</p>
      <section class="next-check" aria-label="Suggested next check"><span class="eyebrow">What needs checking next</span><h3>${esc(next.question)}</h3><details class="check-context"><summary>Why this needs checking</summary><p>${esc(next.rationale)}</p></details><p class="suggestion-note">Suggested from the record · nothing sent or assigned.</p></section>
      <div class="tabs" role="tablist" aria-label="Property information">${tabs.map(([id,label]) => `<button class="tab" id="tab-${id}" type="button" role="tab" tabindex="${activeTab === id ? 0 : -1}" aria-controls="panel-${id}" aria-selected="${activeTab === id}" data-tab="${id}">${esc(label)}</button>`).join('')}</div>
      <section id="panel-summary" role="tabpanel" tabindex="0" aria-labelledby="tab-summary" ${activeTab !== 'summary' ? 'hidden' : ''}><p class="section-intro">${row.issues.length === 1 ? '1 recorded item' : `All ${row.issues.length} recorded items`}. These states describe the supplied evidence, not the property’s current condition.</p>
      ${row.issues.map((issue,index) => {
        const state = guidance.issue_states[index];
        return `<div class="issue"><div class="issue-title"><h3>${esc(issue.label)}</h3><span class="kind">${esc(kinds[issue.kind])}</span></div><span class="state state-${esc(state.state)}">${esc(state.label)}</span><p>${esc(state.note)}</p><div class="issue-footer"><span class="location">${issue.location ? 'Location: ' + esc(issue.location) : 'Location not specified'}</span><button class="text-button" type="button" data-evidence="evidence-issue-${index}" aria-label="View evidence for ${esc(issue.label)}">View evidence</button></div></div>`;
      }).join('')}
      <div class="outcome"><h3>Historical case outcome</h3><p>${esc(row.recorded_outcome)}</p><p class="record-status">Recorded case status: <strong>${esc(row.recorded_status)}</strong>. This does not confirm every item or the present condition.</p></div></section>
      <section id="panel-questions" role="tabpanel" tabindex="0" aria-labelledby="tab-questions" ${activeTab !== 'questions' ? 'hidden' : ''}><p class="section-intro">Questions about the record, not a severity ranking or proof of failed work.</p>${row.caveats.map((question,index) => `<div class="caveat"><h3>${esc(question.label)}</h3><div class="question-tags">${guidance.question_groups[index].tags.map(tag => `<span class="tag">${esc(groups[tag])}</span>`).join('')}</div><p>${esc(question.detail)}</p>${evidence(question.evidence,row,question.label)}</div>`).join('')}</section>
      <section id="panel-evidence" role="tabpanel" tabindex="0" aria-labelledby="tab-evidence" ${activeTab !== 'evidence' ? 'hidden' : ''}><p class="section-intro">Original quotations and the source of each evidence state. Links open the pinned case record.</p><div class="evidence-section" id="evidence-next"><h3>Why this next check is suggested</h3>${quotes(next.evidence,row)}</div>
      ${row.issues.map((issue,index) => `<div class="evidence-section" id="evidence-issue-${index}"><h3>${esc(issue.label)}</h3><p>${esc(guidance.issue_states[index].label)} · ${esc(guidance.issue_states[index].note)}</p>${quotes([...issue.evidence,...guidance.issue_states[index].evidence],row)}</div>`).join('')}
      <div class="evidence-section"><h3>Historical outcome</h3>${quotes(row.outcome_evidence || [],row)}</div>
      <details class="evidence"><summary>Case metadata and source files</summary><dl class="records"><dt>Source case</dt><dd><a href="${esc(row.source_url)}" target="_blank" rel="noopener noreferrer">Case ${esc(row.case_id)}</a></dd><dt>History</dt><dd><a href="${esc(row.source_url + '/history.md')}" target="_blank" rel="noopener noreferrer">${row.history_events} recorded entries</a></dd><dt>Created field</dt><dd>${esc(row.created || 'Not recorded')}</dd><dt>Updated field</dt><dd>${esc(row.updated || 'Not recorded')}</dd><dt>Completed field</dt><dd>${esc(row.completed || 'Not recorded')}</dd><dt>Attachments</dt><dd>${row.attachment_count} supplied files; PDF content not re-examined here.</dd></dl><p class="section-intro">Metadata dates can disagree with history. Some synthetic dates are in the future. Check the record questions before using chronology.</p></details></section></div>`;
    byId('view-evidence').addEventListener('click',() => switchTab('evidence'));
    detail.querySelectorAll('[data-evidence]').forEach(button => button.addEventListener('click',() => switchTab('evidence',button.dataset.evidence)));
    detail.querySelectorAll('[data-tab]').forEach(button => {
      button.addEventListener('click',() => {activeTab = button.dataset.tab; renderDetail(); byId('tab-' + activeTab).focus({preventScroll:true});});
      button.addEventListener('keydown',event => {
        if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
        event.preventDefault();
        const index = tabs.findIndex(([id]) => id === activeTab);
        activeTab = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3][0];
        renderDetail(); byId('tab-' + activeTab).focus({preventScroll:true});
      });
    });
  }
  const mapView = window.createPropertyMap?.({elementId:'street-map',statusId:'map-status',rows,config:dataset.map_display,onSelect:id => selectProperty(id,'map')});
  if (!mapView) byId('map-status').textContent = 'Map unavailable. Use the list to browse property records.';
  function selectProperty(id,origin = 'list') {
    selected = id; activeTab = 'summary'; render(false);
    if (innerWidth <= 760) {detail.scrollIntoView({block:'start'}); detail.focus({preventScroll:true});}
    else if (origin === 'list') list.querySelector('[aria-current="true"]')?.focus({preventScroll:true});
    else if (origin === 'map') detail.focus({preventScroll:true});
  }
  function render(fit = false) {
    const query = search.value.trim().toLowerCase();
    shown = rows.filter(row => (!family.value || row.family === family.value) && (!gap.value || tagsFor(row).includes(gap.value)) && (!query || [row.case_id,row.property,row.title,families[row.family],...row.issues.map(issue => issue.label + ' ' + (issue.location || ''))].join(' ').toLowerCase().includes(query)));
    shown.sort((a,b) => (sort.value === 'issues' ? b.issues.length - a.issues.length : sort.value === 'questions' ? b.caveats.length - a.caveats.length : 0) || a.case_id.localeCompare(b.case_id));
    if (!shown.some(row => row.case_id === selected)) {selected = shown[0]?.case_id; activeTab = 'summary';}
    byId('result-count').textContent = `${shown.length} of ${rows.length} sample properties`;
    byId('clear-filters').hidden = !(search.value || family.value || gap.value || sort.value !== 'case');
    list.innerHTML = shown.length ? shown.map(row => `<button class="property" type="button" data-case="${esc(row.case_id)}" aria-current="${row.case_id === selected}"><span class="ref">CASE ${esc(row.case_id)} · ${esc(families[row.family])}</span><span class="address">${esc(row.property)}</span><span class="caption">${row.issues.length} recorded item${row.issues.length === 1 ? '' : 's'} · ${row.caveats.length} record question${row.caveats.length === 1 ? '' : 's'}</span><span class="list-tags">${tagsFor(row).map(tag => `<span class="tag">${esc(groups[tag])}</span>`).join('')}</span></button>`).join('') : '<div class="empty">No matches. Try another filter or clear the search.</div>';
    list.querySelectorAll('[data-case]').forEach(button => button.addEventListener('click',() => selectProperty(button.dataset.case)));
    const index = shown.findIndex(row => row.case_id === selected);
    byId('selection-position').textContent = shown.length ? `${index + 1} / ${shown.length}` : '0 / 0';
    byId('previous-property').disabled = index <= 0;
    byId('next-property').disabled = index < 0 || index >= shown.length - 1;
    byId('fit-map').disabled = shown.length === 0;
    renderDetail(); mapView?.update(shown,selected,{fit:fit && view === 'map'}); saveView();
  }
  function setView(nextView) {
    view = nextView;
    byId('list-view').hidden = view !== 'list'; byId('map-view').hidden = view !== 'map';
    ['list','map'].forEach(name => byId('view-' + name).setAttribute('aria-pressed',String(view === name)));
    if (view === 'map') {mapView?.refresh(); mapView?.fit();}
    saveView();
  }
  function clearFilters() {search.value = '';family.value = '';gap.value = '';sort.value = 'case';render(true);search.focus({preventScroll:true});}
  ['list','map'].forEach(name => byId('view-' + name).addEventListener('click',() => setView(name)));
  byId('clear-filters').addEventListener('click',clearFilters);
  document.querySelector('.skip-link').addEventListener('click',event => {
    event.preventDefault(); detail.focus({preventScroll:true}); detail.scrollIntoView({block:'start'});
  });
  byId('fit-map').addEventListener('click',() => mapView?.fit());
  ['previous','next'].forEach(direction => byId(direction + '-property').addEventListener('click',() => {
    const index = shown.findIndex(row => row.case_id === selected) + (direction === 'next' ? 1 : -1);
    if (shown[index]) selectProperty(shown[index].case_id,'navigation');
  }));
  search.addEventListener('input',() => render(true));
  [family,gap,sort].forEach(input => input.addEventListener('change',() => render(true)));
  render();setView(view);
}());
