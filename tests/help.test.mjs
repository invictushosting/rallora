import test from 'node:test';
import assert from 'node:assert/strict';
import { HELP_ARTICLES, HELP_CATEGORIES, helpHref, safeClubSlug, searchHelp, suggestedHelp, helpAnswerSection } from '../lib/help.ts';

test('common player and organiser questions find the appropriate instructions', () => {
  for (const [question, slug] of [
    ['How do I submit a result?', 'submit-and-confirm-results'],
    ['How do I connect Playtomic?', 'connect-playtomic'],
    ['record a booking', 'arrange-a-match'],
    ['registration status', 'registration-status'],
    ['not receiving emails', 'emails-and-ratings'],
    ['move teams', 'manage-teams-and-entries'],
    ['no api', 'playtomic-without-api'],
    ['disable reminders', 'club-reminders'],
  ]) assert.equal(searchHelp(question)[0]?.slug, slug, question);
  assert.deepEqual(searchHelp('zzzxyp banana'), []);
  assert.deepEqual(searchHelp('   ').length, HELP_ARTICLES.length);
  assert.ok(searchHelp('', 'clubs').every(a => a.category === 'clubs'));
});

test('helper uses the relevant section for disputes and cancellations', () => {
  const result = HELP_ARTICLES.find(a => a.slug === 'submit-and-confirm-results');
  const booking = HELP_ARTICLES.find(a => a.slug === 'arrange-a-match');
  assert.equal(helpAnswerSection(result, 'How do I dispute a result?').id, 'review');
  assert.equal(helpAnswerSection(booking, 'cancel a booking').id, 'change');
});

test('guide links and section anchors are complete and keep validated club context', () => {
  const slugs = new Set(HELP_ARTICLES.map(a => a.slug));
  assert.equal(slugs.size, HELP_ARTICLES.length);
  for (const a of HELP_ARTICLES) {
    assert.ok(HELP_CATEGORIES.some(c => c.id === a.category));
    assert.ok(a.related.every(id => slugs.has(id) && id !== a.slug));
    assert.equal(new Set(a.sections.map(s => s.id)).size, a.sections.length);
    assert.ok(a.sections.every(s => s.steps.length > 0));
  }
  for (const path of ['/clubs/gsm-padel', '/clubs/gsm-padel/captain', '/clubs/gsm-padel/admin/integrations', '/clubs/gsm-padel/admin', '/clubs/gsm-padel/register']) {
    assert.ok(suggestedHelp(path).every(id => slugs.has(id)));
  }
  assert.equal(helpHref('arrange-a-match', 'gsm-padel'), '/help/arrange-a-match?club=gsm-padel');
  assert.equal(helpHref('', '//evil.example'), '/help');
  assert.equal(safeClubSlug('gsm-padel?other=1'), '');
});


test('player movement help covers all actions, history and recovery', () => {
  const article=HELP_ARTICLES.find(a=>a.slug==='manage-teams-and-entries');
  for(const id of ['replacement','swap','standby','player-history'])assert.ok(article.sections.some(s=>s.id===id));
  assert.equal(searchHelp('swap players')[0]?.slug,article.slug);
  assert.match(JSON.stringify(article),/same operation/);
  assert.match(JSON.stringify(article),/unrecorded substitutions/);
});


test('admin movement help does not require a claimed account',()=>{
 const article=HELP_ARTICLES.find(a=>a.slug==='manage-teams-and-entries');
 const content=JSON.stringify(article);
 assert.match(content,/without creating or claiming a Rallora account/);
 assert.doesNotMatch(content,/must have claimed|before moving them/);
});


test('public fixture help explains division browsing, search and filtered sharing', () => {
  const article = HELP_ARTICLES.find(a => a.slug === 'view-league-fixtures');
  assert.ok(article);
  assert.deepEqual(article.sections.map(s => s.id), ['choose', 'search', 'share']);
  assert.equal(searchHelp('browse fixtures by division')[0]?.slug, 'view-league-fixtures');
  assert.ok(suggestedHelp('/clubs/gsm-padel').includes('view-league-fixtures'));
  assert.match(JSON.stringify(article), /Copy link to this view/);
});

test('late registration help explains admin permissions and fixtures', () => {
  const article=HELP_ARTICLES.find(a=>a.slug==='add-late-team');
  assert.ok(article);
  assert.ok(article.sections.some(s=>s.id==='existing'));
  assert.ok(article.sections.some(s=>s.id==='new'));
  assert.ok(article.sections.some(s=>s.id==='fixtures'));
  assert.match(article.sections.find(s=>s.id==='fixtures').steps.join(' '),/does not regenerate fixtures/);
  assert.equal(suggestedHelp('/clubs/gsm-padel/admin/late-entry')[0],'add-late-team');
  assert.equal(suggestedHelp('/clubs/gsm-padel/admin/registrations')[0],'add-late-team');
});
