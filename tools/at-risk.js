'use strict';
/* AT-RISK — the manifest's third axis, parsed in exactly one place.
 *
 * `outcome` is the prediction against the run: HELD or FAILED. `basis` is the scope
 * of the claim: swept at one width, or argued at every width. **`at_risk` is whether
 * the run could have refuted it at all**, and it is neither of the other two.
 *
 * WHY IT EXISTS. A read-only audit of all 181 predictions registered as of `1acfeee`
 * scored 25 of them DECORATIVE: the answer and its derivation both stood in the
 * registration's own text, over quantities the registrant had stipulated, so the run
 * re-executed arithmetic that was already on the record. Every one of the 25 HELD and
 * not one of the 32 failures was among them, which is the rule validating itself --
 * A FACT THAT WAS NEVER AT RISK CANNOT FAIL. `AGENTS.md` had named the defect from
 * the beginning ("inflating the registered set with facts that were never at risk
 * turns the discipline into decoration") and nothing measured it for forty-three sets.
 *
 * WHY NOT `basis`. It looks like it should have caught this and does not. Of the ten
 * `proven` predictions only five are decorative, and twenty of the twenty-five
 * decorative ones are marked `measured`. A derivation can be genuinely at risk (the
 * derivation may be WRONG, and several here were), and a sweep can be decorative.
 * The two axes are independent and neither may be derived from the other.
 *
 * THE VOCABULARY, which is set `AR`'s and set `AQ`'s -- both wrote `AT RISK:` lines
 * into their registrations. `AQ` was the only one of the 43 sets the audit scored that
 * did, and the only one that scored zero decorative; `AR`, the 44th, was registered the
 * same way and is not part of that sample:
 *
 *     "AT RISK"                    the default. The run could have refuted it.
 *     "AT RISK: <route>"           the same, with the route by which it could have
 *                                  come out the other way written down. `AR`'s four
 *                                  carry their registered wording verbatim after the
 *                                  colon.
 *     "NOT AT RISK: <reason>"      decorative. Only ever honest on a HELD prediction,
 *                                  though see the note in test-findings.js: that is a
 *                                  property that currently holds, not a law.
 *     "UNCALLED: <reason>"         the audit could not decide, and forcing it either
 *                                  way would be a worse record than saying so.
 *
 * Anything else is MALFORMED and is reported as such rather than being guessed at.
 * There is no default value: a prediction with no `at_risk` field is a set that was
 * registered without anyone asking what the run could have done to it.
 */

const AT_RISK = 'AT RISK';
const NOT_AT_RISK = 'NOT AT RISK: ';
const UNCALLED = 'UNCALLED: ';

/**
 * One of 'at-risk', 'not-at-risk', 'uncalled', or null when the value is absent or
 * does not follow the vocabulary. Null is never silently folded into a bucket --
 * a count that quietly absorbs malformed rows is how a missing annotation becomes
 * invisible, which is the whole failure this field exists to prevent.
 */
function classify(v) {
  if (typeof v !== 'string') return null;
  if (v.startsWith(NOT_AT_RISK)) return v.length > NOT_AT_RISK.length ? 'not-at-risk' : null;
  if (v.startsWith(UNCALLED)) return v.length > UNCALLED.length ? 'uncalled' : null;
  if (v === AT_RISK) return 'at-risk';
  if (v.startsWith(AT_RISK + ': ')) return v.length > AT_RISK.length + 2 ? 'at-risk' : null;
  return null;
}

/** The text after the sentinel, or '' where the value carries none. */
function reason(v) {
  const k = classify(v);
  if (k === 'not-at-risk') return v.slice(NOT_AT_RISK.length);
  if (k === 'uncalled') return v.slice(UNCALLED.length);
  if (k === 'at-risk' && v !== AT_RISK) return v.slice(AT_RISK.length + 2);
  return '';
}

/** Short label for a renderer. The default prints nothing; the exceptions print. */
function label(v) {
  const k = classify(v);
  if (k === 'not-at-risk') return 'NOT AT RISK';
  if (k === 'uncalled') return 'AT-RISK VERDICT UNCALLED';
  return null;
}

/**
 * Every number the corrected record needs, over whatever list of predictions it is
 * handed. Both rates are returned, because a correction that hides what was
 * previously claimed is a worse defect than the thing it corrects: `raw` is the
 * failure rate over everything registered, `corrected` is the rate over what was
 * genuinely at risk, and they answer different questions.
 */
function tally(preds) {
  const kind = p => classify(p.at_risk);
  const atRisk = preds.filter(p => kind(p) === 'at-risk');
  const notAtRisk = preds.filter(p => kind(p) === 'not-at-risk');
  const uncalled = preds.filter(p => kind(p) === 'uncalled');
  const malformed = preds.filter(p => kind(p) === null).map(p => p.id);
  const failed = preds.filter(p => p.outcome === 'FAILED');
  const failedAtRisk = atRisk.filter(p => p.outcome === 'FAILED');
  const pct = (a, b) => (b === 0 ? 0 : Math.round((a / b) * 1000) / 10);
  return {
    total: preds.length,
    atRisk: atRisk.length,
    notAtRisk: notAtRisk.length,
    uncalled: uncalled.length,
    malformed,
    heldAtRisk: atRisk.length - failedAtRisk.length,
    failedAtRisk: failedAtRisk.length,
    failed: failed.length,
    // Failures that are marked as never having been at risk. Zero today across all
    // 185, and that is evidence rather than an axiom -- see test-findings.js.
    failedNotAtRisk: failed.filter(p => kind(p) !== 'at-risk').map(p => p.id),
    rateRaw: pct(failed.length, preds.length),
    rateCorrected: pct(failedAtRisk.length, atRisk.length),
  };
}

/**
 * The other half of the annotation: a registration must say what would refute each
 * prediction. Splits a tool's `PREDICTED OUTCOMES` block into one paragraph per
 * prediction id and returns each one's `AT RISK` TEXT, or null where there is none.
 *
 * Same block-finding and same id pattern as the completeness check in
 * test-findings.js, deliberately: a second parser is a second thing to disagree.
 *
 * The text runs from the `AT RISK` line to the next all-capitals label in the same
 * paragraph -- `CANNOT SHOW:` in `AQ`'s and `AR`'s blocks -- or to the paragraph's end.
 */
/**
 * Every spelling this block's header has EVER had. Not a style list -- a vocabulary,
 * and the UNION OVER HISTORY rather than whatever the working tree says today.
 *
 * `AQ` registered under the second spelling. The criteria audit's extractor searched
 * for the first only, matched nothing, fell back to the manifest's one-line summary,
 * and `AQ` became the one set in the corpus whose registered criteria were never read
 * -- then the set whose classification was found wrong on all three of its predictions.
 * The header was normalised at some later commit, so a grep of `tools/` reports all 47
 * fine and always fine, and the evidence of the fault is edited out of the only place
 * anyone would look.
 *
 * `test-findings.js` section 10 guards that class with its own search over both
 * spellings. This list exists because that guard was the ONLY thing that knew, while
 * every caller of the function below still carried the narrow vocabulary -- so the next
 * one would have fallen into the same hole, silently, and no check reads a caller's
 * assumptions. A workaround in the checker is not a fix in the instrument.
 *
 * Append, never replace. Removing a spelling silently unreads a registration.
 */
const REGISTRATION_HEADERS = ['PREDICTED OUTCOMES', 'REGISTERED PREDICTIONS'];

function registrationRisk(src, py = false) {
  // Earliest match over the whole vocabulary, not first-listed: a tool that names the
  // older spelling in a comment must not out-rank the block it actually uses.
  let from = -1;
  for (const h of REGISTRATION_HEADERS) {
    const at = src.indexOf(h);
    if (at !== -1 && (from === -1 || at < from)) from = at;
  }
  if (from === -1) return null;
  const to = py ? src.indexOf('"""', from) : src.indexOf(' */', from);
  const lines = src.slice(from, to === -1 ? undefined : to).split('\n');
  const pat = py ? /^\s{2}([A-Z]{1,2}\d+[a-z]?)\s/ : /^ \*\s{3}([A-Z]{1,2}\d+[a-z]?)\s/;
  const starts = [];
  lines.forEach((l, i) => { const m = pat.exec(l); if (m) starts.push([i, m[1]]); });
  const out = {};
  starts.forEach(([i, id], k) => {
    const j = k + 1 < starts.length ? starts[k + 1][0] : lines.length;
    const para = lines.slice(i, j).map(l => (py ? l : l.replace(/^ \*\s?/, '')));
    const at = para.findIndex(l => /AT RISK/.test(l));
    if (at === -1) { out[id] = null; return; }
    const text = [];
    for (let q = at; q < para.length; q++) {
      if (q > at && /^\s{0,10}[A-Z][A-Z ]{4,}:/.test(para[q])) break;
      text.push(para[q].trim());
    }
    out[id] = text.join(' ').replace(/\s+/g, ' ').trim();
  });
  return out;
}

/**
 * A FLOOR, AND ONLY A FLOOR. This cannot tell whether an annotation is TRUE, and it
 * must never be read as saying so -- a guard whose limit is unstated gets taken for
 * something stronger, which is how a green check becomes evidence for a thing it never
 * measured. All it rejects is an annotation that says nothing: the label restated, or
 * too short to name any observation at all.
 *
 * The standard is what `AQ` and `AR` actually wrote. `AR1`'s line reads "AT RISK: this
 * comes out the other way if ONE leaf count anywhere in [2, 8192] has a factorisation
 * that leaves the constant optimiser worse stranded than N = 11 did" -- a specific
 * observation that would refute, with the registrant's own hand evidence beside it.
 * `AR3`'s says outright which way its author's sample pointed and registers against it.
 * The failure mode this is watching for is that decaying into "genuinely at risk" as
 * prose: the check stays green, the corpus looks disciplined, and nothing is at risk.
 * That form is the antibody's own autoimmune version, and only a reader catches it.
 */
function vacuous(text) {
  if (typeof text !== 'string') return true;
  const t = text.replace(/^AT RISK[^:]*:?/i, '').replace(/\s+/g, ' ').trim();
  if (t.length < 60) return true;
  return /^(yes|entirely|genuinely at risk|at risk|it could fail|this could fail)\W*$/i.test(t);
}

module.exports = {
  AT_RISK, NOT_AT_RISK, UNCALLED, classify, reason, label, tally, registrationRisk,
  vacuous, REGISTRATION_HEADERS,
};
